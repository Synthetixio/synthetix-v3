const { task, types } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');
const { TASK_DEPLOY, SUBTASK_DEPLOY_MODULES } = require('../task-names');
const logger = require('../utils/logger');
const prompter = require('../utils/prompter');

task(
  TASK_DEPLOY,
  'Deploys all modules that changed, and generates and deploys a router for those modules'
)
  .addFlag('noConfirm', 'Skip confirmations', false, types.boolean)
  .addOptionalParam('logLevel', '1 = minimal, 2 = descriptive, 3 = debug', 1, types.int)
  .setAction(async (taskArguments, hre) => {
    await hre.run(TASK_COMPILE, taskArguments);

    logger.logLevel = taskArguments.logLevel;
    prompter.noConfirm = taskArguments.noConfirm;

    logger.log('Deploying system...');

    await hre.run(SUBTASK_DEPLOY_MODULES, taskArguments);
  });
