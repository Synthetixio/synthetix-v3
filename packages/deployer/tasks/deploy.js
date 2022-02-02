const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

const {
  SUBTASK_CANCEL_DEPLOYMENT,
  SUBTASK_CLEAR_DEPLOYMENTS,
  SUBTASK_CREATE_DEPLOYMENT,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_DEPLOY_PROXY,
  SUBTASK_DEPLOY_ROUTER,
  SUBTASK_FINALIZE_DEPLOYMENT,
  SUBTASK_GENERATE_ROUTER_SOURCE,
  SUBTASK_LOAD_DEPLOYMENT,
  SUBTASK_PRINT_INFO,
  SUBTASK_SYNC_PROXY,
  SUBTASK_SYNC_SOURCES,
  SUBTASK_UPGRADE_PROXY,
  SUBTASK_VALIDATE_INITIALIZABLES,
  SUBTASK_VALIDATE_INTERFACES,
  SUBTASK_VALIDATE_MODULES,
  SUBTASK_VALIDATE_ROUTER,
  SUBTASK_VALIDATE_SATELLITES,
  SUBTASK_VALIDATE_STORAGE,
  TASK_DEPLOY,
} = require('../task-names');

const logger = require('@synthetixio/core-js/utils/io/logger');
const prompter = require('@synthetixio/core-js/utils/io/prompter');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { ContractValidationError } = require('../internal/errors');
const { readPackageJson } = require('@synthetixio/core-js/utils/misc/npm');

task(TASK_DEPLOY, 'Deploys all system modules')
  .addFlag('noConfirm', 'Skip all confirmation prompts', false)
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('quiet', 'Silence all output', false)
  .addFlag('clear', 'Clear all previous deployment data for the selected network', false)
  .addOptionalParam('alias', 'The alias name for the deployment', undefined, types.alphanumeric)
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .setAction(async (taskArguments, hre) => {
    const { clear, debug, quiet, noConfirm } = taskArguments;

    logger.quiet = quiet;
    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    // Do not throw an error on missing package.json
    // This is so we don't force the user to have the file on tests just for the name
    try {
      await logger.title(readPackageJson().name);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    await logger.title('DEPLOYER');

    try {
      if (clear) {
        await hre.run(SUBTASK_CLEAR_DEPLOYMENTS, taskArguments);
      }

      await hre.run(SUBTASK_CREATE_DEPLOYMENT, taskArguments);
      await hre.run(SUBTASK_LOAD_DEPLOYMENT, taskArguments);
      await hre.run(SUBTASK_PRINT_INFO, taskArguments);
      await _compile(hre, quiet);
      await hre.run(SUBTASK_SYNC_SOURCES);
      await hre.run(SUBTASK_SYNC_PROXY);
      await hre.run(SUBTASK_VALIDATE_STORAGE);
      await hre.run(SUBTASK_VALIDATE_MODULES);
      await hre.run(SUBTASK_VALIDATE_INTERFACES);
      await hre.run(SUBTASK_VALIDATE_INITIALIZABLES);
      await hre.run(SUBTASK_VALIDATE_SATELLITES);
      await hre.run(SUBTASK_DEPLOY_MODULES);
      await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
      await _compile(hre, quiet);
      await hre.run(SUBTASK_VALIDATE_ROUTER);
      await hre.run(SUBTASK_DEPLOY_ROUTER);
      await hre.run(SUBTASK_DEPLOY_PROXY);
      await hre.run(SUBTASK_UPGRADE_PROXY);
      await hre.run(SUBTASK_FINALIZE_DEPLOYMENT);
    } catch (err) {
      if (err instanceof ContractValidationError) {
        await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
      }

      throw err;
    }
  });

/*
 * Note: Even though hardhat's compile task has a quiet option,
 * it still prints some output. This is a hack to completely silence
 * output during compile task run.
 */
async function _compile(hre, quiet) {
  let logCache;

  if (quiet) {
    logCache = console.log;
    console.log = () => {};
  }

  try {
    await hre.run(TASK_COMPILE, { force: true, quiet: true });
  } finally {
    if (logCache) console.log = logCache;
  }
}
