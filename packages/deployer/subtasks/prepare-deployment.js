const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');
const { readDeploymentFile, createDeploymentFileIfNeeded } = require('../utils/io');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

let _hre;

/*
 * Prepares the deployment file associated with the active deployment.
 * */
subtask(SUBTASK_PREPARE_DEPLOYMENT).setAction(async (taskArguments, hre) => {
  _hre = hre;

  const package = readPackageJson({ hre: _hre });
  logger.title(`Deploying ** ${package.name} **`);

  const data = {
    properties: {
      completed: false,
    },
    modules: {},
  };

  createDeploymentFileIfNeeded({ data, hre });
  const deploymentFile = readDeploymentFile({ hre });

  if (!hre.deployer) {
    hre.deployer = {};
  }

  hre.deployer.file = deploymentFile.file;
  hre.deployer.data = deploymentFile.data;

  await _printInfo(taskArguments);

  await prompter.confirmAction('Proceed with deployment');
});

function _printInfo(taskArguments) {
  console.log(chalk.yellow('------------------------------------------------------------'));

  console.log(chalk.gray(`commit: ${getCommit()}`));

  const branch = getBranch();
  console.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));

  const network = _hre.network.name;
  console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));

  console.log(chalk.gray(`debug: ${taskArguments.debug}`));

  console.log(chalk.gray(`deployment file: ${_hre.deployer.file}`));

  if (taskArguments.force) {
    console.log(chalk.red('force: true - This will override all existing deployments!'));
  } else {
    console.log(chalk.gray('force: false'));
  }

  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(_hre.config.deployer, null, 2));

  console.log(chalk.yellow('------------------------------------------------------------'));
}
