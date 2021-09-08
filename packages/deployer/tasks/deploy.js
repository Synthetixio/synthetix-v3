const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const {
  SUBTASK_CLEAR_DEPLOYMENTS,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_DEPLOY_ROUTER,
  SUBTASK_FINALIZE_DEPLOYMENT,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_PREPARE_DEPLOYMENT,
  SUBTASK_PRINT_INFO,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_UPGRADE_PROXY,
  SUBTASK_VALIDATE_ROUTER,
  TASK_DEPLOY,
} = require('../task-names');
const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js//utils/prompter');
const { getDeploymentPaths } = require('../utils/deployments');
const types = require('../utils/argument-types');

task(TASK_DEPLOY, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('clear', 'Clear all previous deployment data for the selected network', false)
  .addOptionalParam('alias', 'The alias name for the deployment', undefined, types.alphanumeric)
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .setAction(async (taskArguments, hre) => {
    const { alias, instance, clear, debug, noConfirm } = taskArguments;

    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    if (clear) {
      await hre.run(SUBTASK_CLEAR_DEPLOYMENTS);
    }

    hre.deployer.paths = getDeploymentPaths(hre.config, {
      instance,
      network: hre.network.name,
    });

    await hre.run(SUBTASK_PREPARE_DEPLOYMENT, { alias });
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
    await hre.run(SUBTASK_SYNC_SOURCES);
    await hre.run(SUBTASK_DEPLOY_MODULES);
    await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
    await hre.run(SUBTASK_VALIDATE_ROUTER);
    await hre.run(SUBTASK_DEPLOY_ROUTER);
    await hre.run(SUBTASK_UPGRADE_PROXY);
    await hre.run(SUBTASK_FINALIZE_DEPLOYMENT);
  });
