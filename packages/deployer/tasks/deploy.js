const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { task, types } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { readPackageJson } = require('../utils/package');
const { getCommit, getBranch } = require('../utils/git');

const {
  TASK_DEPLOY,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_DEPLOY_ROUTER,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules and upgrades the main proxy with a new router')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('force', 'Force deploy all modules', false)
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async ({ force, debug, noConfirm }, hre) => {
    logger.debug = debug;
    prompter.noConfirm = noConfirm;

    _printInfo({ force, debug }, hre);

    // Confirm!
    await prompter.confirmAction('Proceed with deployment?');

    await hre.run(TASK_COMPILE, { force: true });
    await hre.run(SUBTASK_SYNC_SOURCES, {});
    await hre.run(SUBTASK_DEPLOY_MODULES, { force });

    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, {});
    // TODO: Validate router here

    await hre.run(SUBTASK_DEPLOY_ROUTER, { force });
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
  console.log(chalk.yellow('------------------------------------------------------------'));
}
