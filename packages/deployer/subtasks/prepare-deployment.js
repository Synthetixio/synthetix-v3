const fs = require('fs');
const path = require('path');
const figlet = require('figlet');
const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

const DEPLOYMENT_SCHEMA = {
  properties: {
    completed: false,
    totalGasUsed: 0,
  },
  transactions: {},
  contracts: {
    modules: {},
  },
};

/*
 * Prepares the deployment file associated with the active deployment.
 * */
subtask(SUBTASK_PREPARE_DEPLOYMENT).setAction(async (taskArguments, hre) => {
  await _printTitle();

  if (!hre.deployer) {
    hre.deployer = {};
  }

  const { clear } = taskArguments;
  if (clear) {
    await _clearPreviousDeploymentData();
  }

  _ensureFoldersExist();

  hre.deployer.file = _determineTargetDeploymentFile();
  await _printInfo(taskArguments);

  await prompter.confirmAction('Proceed with deployment');

  _createDeploymentFileIfNeeded();

  hre.deployer.data = _setupAutosaveProxy({ hre });
});

async function _printTitle() {
  async function figPring(msg, font = 'Slant') {
    return new Promise((resolve) => {
      figlet.text(msg, { font }, function (err, formattedMsg) {
        if (err) {
          throw new Error(err);
        }

        console.log(chalk.red(formattedMsg));
        resolve();
      });
    });
  }

  await figPring(readPackageJson().name);
  await figPring('           deployer');
}

async function _clearPreviousDeploymentData() {
  logger.warn('Received --clear parameter. This will delete all previous deployment data!');
  await prompter.confirmAction('Clear all data');

  const deploymentsFolder = hre.config.deployer.paths.deployments;
  const networkFolder = path.join(deploymentsFolder, hre.network.name);

  if (fs.existsSync(networkFolder)) {
    rimraf.sync(networkFolder);
  }
}

function _setupAutosaveProxy({ hre }) {
  const data = JSON.parse(fs.readFileSync(hre.deployer.file));

  const handler = {
    get: (target, key) => {
      if (typeof target[key] === 'object' && target[key] !== null) {
        return new Proxy(target[key], handler);
      } else {
        return target[key];
      }
    },

    set: (target, key, value) => {
      logger.debug('Setting property in deployer.data:');
      logger.debug(`  > key: ${key}`);
      logger.debug(`  > value: ${JSON.stringify(value)}`);

      if (target[key] === value) {
        logger.debug('No changes - skipping write to deployment file');
      } else {
        target[key] = value;

        fs.writeFileSync(hre.deployer.file, JSON.stringify(hre.deployer.data, null, 2));

        logger.debug(`Deployment file saved: ${hre.deployer.file}`);
      }
    },
  };

  return new Proxy(data, handler);
}

function _createDeploymentFileIfNeeded() {
  if (!fs.existsSync(hre.deployer.file)) {
    const deployments = _getPastDeployments();

    let data;
    for (let deployment of deployments) {
      hre.deployer.previousData = JSON.parse(fs.readFileSync(deployment));

      if (hre.deployer.previousData.properties.completed) {
        logger.info(`Starting new deployment where previous deployment left off: ${deployment}`);

        data = hre.deployer.previousData;

        data.properties.completed = false;
        data.properties.totalGasUsed = 0;
        data.transactions = {};

        break;
      }
    }

    if (!data) {
      data = DEPLOYMENT_SCHEMA;
    }

    logger.success(`New deployment file created: ${hre.deployer.file}`);

    fs.appendFileSync(hre.deployer.file, JSON.stringify(data, null, 2));
  }
}

function _getPastDeployments() {
  const targetFolder = path.join(hre.config.deployer.paths.deployments, hre.network.name);

  return fs
    .readdirSync(targetFolder)
    .map((filename) => path.join(targetFolder, filename))
    .reverse();
}

function _determineTargetDeploymentFile() {
  const targetFolder = path.join(hre.config.deployer.paths.deployments, hre.network.name);

  const deployments = _getPastDeployments();

  function __getNewDeploymentFileName() {
    return path.join(
      targetFolder,
      `${hre.network.name}_${Math.floor(new Date().getTime() / 1000)}.json`
    );
  }

  if (deployments.length === 0) {
    return __getNewDeploymentFileName();
  }

  const file = deployments[0];
  const data = JSON.parse(fs.readFileSync(file));

  if (data.properties.completed) {
    return __getNewDeploymentFileName();
  } else {
    return file;
  }
}

function _ensureFoldersExist() {
  const deploymentsFolder = hre.config.deployer.paths.deployments;
  if (!fs.existsSync(deploymentsFolder)) {
    fs.mkdirSync(deploymentsFolder);
  }

  const networkFolder = path.join(deploymentsFolder, hre.network.name);
  console.log(networkFolder);
  console.log('>', fs.existsSync(networkFolder));
  if (!fs.existsSync(networkFolder)) {
    console.log('CREATE');
    fs.mkdirSync(networkFolder);
  }

  console.log('>', fs.existsSync(networkFolder));
}

async function _printInfo(taskArguments) {
  logger.log(chalk.yellow('\nPlease confirm these deployment parameters:'));
  logger.boxStart();

  logger.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  logger.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = hre.network.name;
  logger.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  logger.log(chalk.gray(`debug: ${taskArguments.debug}`));

  if (fs.existsSync(hre.deployer.file)) {
    logger.log(chalk.gray(`deployment file: ${hre.deployer.file}`));
  } else {
    logger.log(chalk.green(`new deployment file: ${hre.deployer.file}`));
  }

  const signer = (await hre.ethers.getSigners())[0];
  const balance = hre.ethers.utils.formatEther(
    await hre.ethers.provider.getBalance(signer.address)
  );
  logger.log(chalk.gray(`signer: ${signer.address}`));
  logger.log(chalk.gray(`signer balance: ${balance} ETH`));

  if (taskArguments.clear) {
    logger.log(chalk.red('clear: true'));
  }

  logger.boxEnd();

  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(hre.config.deployer, null, 2));
}
