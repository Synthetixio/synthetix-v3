const { task, types } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const chalk = require('chalk');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');

const {
  TASK_DEPLOY,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_GENERATE_ROUTER_SOURCE,
} = require('../task-names');

task(
  TASK_DEPLOY,
  'Deploys all modules that changed, and generates and deploys a router for those modules'
)
  .addFlag('noConfirm', 'Skip all confirmations', false)
  .addFlag('force', 'Ignore all previously deployed contracts', false)
  .addOptionalParam(
    'logLevel',
    'Control stdout output level: 1 = minimal, 2 = descriptive, 3 = debug',
    1,
    types.int
  )
  .setAction(async (taskArguments, hre) => {
    await hre.run(TASK_COMPILE, taskArguments);

    logger.logLevel = taskArguments.logLevel;
    prompter.noConfirm = taskArguments.noConfirm;

    logger.log(chalk.blue(`Deploying system in ${hre.network.name}`));

    await hre.run(SUBTASK_DEPLOY_MODULES, taskArguments);
    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, taskArguments);
  });
