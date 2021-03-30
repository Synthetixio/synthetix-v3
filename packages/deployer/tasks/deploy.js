const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const {
  TASK_DEPLOY,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_DEPLOY_ROUTER,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_VALIDATE_ROUTER,
  SUBTASK_UPGRADE_PROXY,
  SUBTASK_PREPARE_DEPLOYMENT,
  SUBTASK_FINALIZE_DEPLOYMENT,
  SUBTASK_PRINT_INFO,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules and upgrades the main proxy with a new router')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('clear', 'Clear all previous deployment data for the selected network', false)
  .setAction(async (taskArguments, hre) => {
    const { debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    await hre.run(SUBTASK_PREPARE_DEPLOYMENT, taskArguments);
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
    await hre.run(SUBTASK_SYNC_SOURCES, {});
    await hre.run(SUBTASK_DEPLOY_MODULES, {});
    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, {});
    await hre.run(SUBTASK_VALIDATE_ROUTER, {});
    await hre.run(SUBTASK_DEPLOY_ROUTER, {});
    await hre.run(SUBTASK_UPGRADE_PROXY, {});
    await hre.run(SUBTASK_FINALIZE_DEPLOYMENT, {});
  });
