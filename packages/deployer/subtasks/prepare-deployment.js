const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

let _hre;

/*
 * Prepares the deployment file associated with the active deployment.
 * */
subtask(SUBTASK_PREPARE_DEPLOYMENT).setAction(async (taskArguments, hre) => {
  _hre = hre;

  const package = readPackageJson({ hre: _hre });
  logger.title(`Deploying ** ${package.name} **`);

  if (!hre.deployer) {
    hre.deployer = {};
  }

  hre.deployer.file = _determineTargetDeploymentFile();

  await _printInfo(taskArguments);
  await prompter.confirmAction('Proceed with deployment');

  _ensureFoldersExist();

  _createDeploymentFileIfNeeded();

  hre.deployer.data = JSON.parse(fs.readFileSync(hre.deployer.file));

  hre.deployer.save = () =>
    fs.writeFileSync(hre.deployer.file, JSON.stringify(hre.deployer.data, null, 2));
});

function _createDeploymentFileIfNeeded() {
  if (!fs.existsSync(_hre.deployer.file)) {
    const deployments = _getPastDeployments();

    let data;
    for (let deployment of deployments) {
      _hre.deployer.previousData = JSON.parse(fs.readFileSync(deployment));

      if (_hre.deployer.previousData.properties.completed) {
        logger.info(`Starting new deployment where previous deployment left off: ${deployment}`);

        data = _hre.deployer.previousData;

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

    logger.success(`New deployment file created: ${_hre.deployer.file}`);

    fs.appendFileSync(_hre.deployer.file, JSON.stringify(data, null, 2));
  }
}

function _getPastDeployments() {
  const targetFolder = path.join(_hre.config.deployer.paths.deployments, _hre.network.name);

  return fs
    .readdirSync(targetFolder)
    .map((filename) => path.join(targetFolder, filename))
    .reverse();
}

function _determineTargetDeploymentFile() {
  const targetFolder = path.join(_hre.config.deployer.paths.deployments, _hre.network.name);

  const deployments = _getPastDeployments();

  function __getNewDeploymentFileName() {
    return path.join(
      targetFolder,
      `${_hre.network.name}_${Math.floor(new Date().getTime() / 1000)}.json`
    );
  }

  if (deployments.length === 0) {
    logger.notice(`No previous deployment file found for ${_hre.network.name}`);

    return __getNewDeploymentFileName();
  }

  const file = deployments[0];
  const data = JSON.parse(fs.readFileSync(file));

  if (data.properties.completed) {
    logger.checked(`Previous deployment on ${_hre.network.name} was completed`);

    return __getNewDeploymentFileName();
  } else {
    return file;
  }
}

function _ensureFoldersExist() {
  const deploymentsFolder = _hre.config.deployer.paths.deployments;
  if (!fs.existsSync(deploymentsFolder)) {
    fs.mkdirSync(deploymentsFolder);
  }

  const networkFolder = path.join(deploymentsFolder, _hre.network.name);
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

  const network = _hre.network.name;
  console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  console.log(chalk.gray(`debug: ${taskArguments.debug}`));

  if (fs.existsSync(_hre.deployer.file)) {
    console.log(chalk.gray(`deployment file: ${_hre.deployer.file}`));
  } else {
    console.log(chalk.green(`new deployment file: ${_hre.deployer.file}`));
  }

  if (taskArguments.force) {
    console.log(chalk.red('force: true - This will override all existing deployments!'));
  } else {
    console.log(chalk.gray('force: false'));
  }

  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(_hre.config.deployer, null, 2));

  console.log(chalk.yellow('------------------------------------------------------------'));
}
