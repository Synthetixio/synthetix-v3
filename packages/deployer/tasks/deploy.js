const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { getSourceModules } = require('../utils/getSourceModules');
const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');

const {
  TASK_DEPLOY,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_DEPLOY_CONTRACTS,
  SUBTASK_VALIDATE_ROUTER,
  SUBTASK_UPGRADE_PROXY,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules and upgrades the main proxy with a new router')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('force', 'Force deploy all modules', false)
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async ({ force, debug, noConfirm }, hre) => {
    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    _printInfo({ force, debug }, hre);

    await prompter.confirmAction('Proceed with deployment');

    await hre.run(TASK_COMPILE, { force: true, quiet: true });
    await hre.run(SUBTASK_SYNC_SOURCES, {});

    logger.subtitle('Deploying system modules');
    const sources = getSourceModules({ hre });
    await hre.run(SUBTASK_DEPLOY_CONTRACTS, { contractNames: sources, areModules: true, force });

    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, {});
    await hre.run(SUBTASK_VALIDATE_ROUTER, {});

    logger.subtitle('Deploying router');
    await hre.run(TASK_COMPILE, { force: false, quiet: true });
    await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
      contractNames: [`Router_${hre.network.name}`],
      force,
    });

    await hre.run(SUBTASK_UPGRADE_PROXY, {});
  });

function _printInfo({ force, debug }, hre) {
  const package = readPackageJson({ hre });
  const network = hre.network.name;
  const branch = getBranch();
  const commit = getCommit();

  logger.title(`Deploying ** ${package.name} **`);

  console.log(chalk.yellow('------------------------------------------------------------'));
  console.log(chalk.gray(`commit: ${commit}`));
  console.log(chalk[branch !== 'master' ? 'red' : 'gray'](`branch: ${branch}`));
  console.log(chalk[network.includes('mainnet') ? 'red' : 'gray'](`network: ${network}`));
  console.log(chalk.gray(`debug: ${debug}`));
  if (force) {
    console.log(chalk.red('force: true - This will override all existing deployments!'));
  } else {
    console.log(chalk.gray('force: false'));
  }
  logger.debug('Deployer configuration:');
  logger.debug(JSON.stringify(hre.config.deployer, null, 2));
  console.log(chalk.yellow('------------------------------------------------------------'));
}
