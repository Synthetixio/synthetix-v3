const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const {
  TASK_DEPLOY,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_DEPLOY_CONTRACTS,
  SUBTASK_VALIDATE_ROUTER,
  SUBTASK_UPGRADE_PROXY,
  SUBTASK_PREPARE_DEPLOYMENT,
  SUBTASK_FINALIZE_DEPLOYMENT,
} = require('../task-names');

task(TASK_DEPLOY, 'Deploys all system modules and upgrades the main proxy with a new router')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('force', 'Force deploy all modules', false)
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async (taskArguments, hre) => {
    const { force, debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    await hre.run(SUBTASK_PREPARE_DEPLOYMENT, taskArguments);

    await hre.run(TASK_COMPILE, { force: true, quiet: true });
    await hre.run(SUBTASK_SYNC_SOURCES, {});

    logger.subtitle('Deploying system modules');
    await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
      contractNames: hre.deployer.sources,
      areModules: true,
      force,
    });

    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE, {});
    await hre.run(SUBTASK_VALIDATE_ROUTER, {});

    logger.subtitle('Deploying router');
    await hre.run(TASK_COMPILE, { force: false, quiet: true });
    await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
      contractNames: [`Router_${hre.network.name}`],
      force,
    });

    await hre.run(SUBTASK_UPGRADE_PROXY, {});

    await hre.run(SUBTASK_FINALIZE_DEPLOYMENT, {});
  });
