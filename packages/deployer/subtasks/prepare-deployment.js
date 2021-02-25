const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

/*
 * Prepares the deployment file associated with the active deployment.
 * */
subtask(SUBTASK_PREPARE_DEPLOYMENT).setAction(async (taskArguments, hre) => {
  const package = readPackageJson();
  logger.title(`Deploying ** ${package.name} **`);

  if (!hre.deployer) {
    hre.deployer = {};
  }

  hre.deployer.file = _determineTargetDeploymentFile();

  await _printInfo(taskArguments);
  await prompter.confirmAction('Proceed with deployment');

  _ensureFoldersExist();
  _createDeploymentFileIfNeeded();

  hre.deployer.data = _setupAutosaveProxy();
});

function _setupAutosaveProxy() {
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

        logger.info('Deployment file saved');
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

        break;
      }
    }

    if (!data) {
      data = {
        properties: {
          completed: false,
        },
        modules: {},
      };
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
    logger.notice(`No previous deployment file found for ${hre.network.name}`);

    return __getNewDeploymentFileName();
  }

  const file = deployments[0];
  const data = JSON.parse(fs.readFileSync(file));

  if (data.properties.completed) {
    logger.checked(`Previous deployment on ${hre.network.name} was completed`);

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
  if (!fs.existsSync(networkFolder)) {
    fs.mkdirSync(networkFolder);
  }
}

function _printInfo(taskArguments) {
  console.log(chalk.yellow('\nPLEASE CONFIRM THESE PARAMETERS'));
  console.log(chalk.yellow('------------------------------------------------------------'));

  console.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  console.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = hre.network.name;
  console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  console.log(chalk.gray(`debug: ${taskArguments.debug}`));

  if (fs.existsSync(hre.deployer.file)) {
    console.log(chalk.gray(`deployment file: ${hre.deployer.file}`));
  } else {
    console.log(chalk.green(`new deployment file: ${hre.deployer.file}`));
  }

  if (taskArguments.force) {
    console.log(chalk.red('force: true - This will override all existing deployments!'));
  } else {
    console.log(chalk.gray('force: false'));
  }

  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(hre.config.deployer, null, 2));

  console.log(chalk.yellow('------------------------------------------------------------'));
}
