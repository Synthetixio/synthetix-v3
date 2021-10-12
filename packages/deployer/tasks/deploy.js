const { task } = require('hardhat/config');
const { TASK_COMPILE } = require('hardhat/builtin-tasks/task-names');

// This fixes a very strange bug in hardhat that should be fixed soon.
// When using the hardhat network, the signer suddenly runs out of ETH =O
// This is caused by a prototype pollution problem in ANTLR in Immutable.js.
// It should be fixed soon in a future hardhat version.
// If fixes, you should be able to run `npx hardhat deploy --no-confirm --clear --network hardhat`
// without errors.
// On the meantime, this line produces the local fix.
// Repo used to reproduce: https://github.com/ajsantander/weird
// PR that fixes this in hardhat: https://github.com/nomiclabs/hardhat/pull/1945
require('@solidity-parser/parser')

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
  SUBTASK_VALIDATE_MODULES,
  SUBTASK_VALIDATE_STORAGE,
  TASK_DEPLOY,
} = require('../task-names');

let logCache;

const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const types = require('../internal/argument-types');

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

    _forceSilenceHardhat(true, quiet);

    logger.quiet = quiet;
    logger.debugging = debug;
    prompter.noConfirm = noConfirm;

    try {
      if (clear) {
        await hre.run(SUBTASK_CLEAR_DEPLOYMENTS, taskArguments);
      }

      await hre.run(SUBTASK_PREPARE_DEPLOYMENT, taskArguments);
      await hre.run(SUBTASK_PRINT_INFO, taskArguments);
      await hre.run(TASK_COMPILE, { force: true, quiet: true });
      await hre.run(SUBTASK_SYNC_SOURCES);
      await hre.run(SUBTASK_VALIDATE_STORAGE);
      await hre.run(SUBTASK_VALIDATE_MODULES);
      await hre.run(SUBTASK_DEPLOY_MODULES);
      await hre.run(SUBTASK_GENERATE_ROUTER_SOURCE);
      await hre.run(TASK_COMPILE, { force: true, quiet: true });
      await hre.run(SUBTASK_VALIDATE_ROUTER);
      await hre.run(SUBTASK_DEPLOY_ROUTER);
      await hre.run(SUBTASK_UPGRADE_PROXY);
      await hre.run(SUBTASK_FINALIZE_DEPLOYMENT);
    } finally {
      _forceSilenceHardhat(false, quiet);
    }
  });

/*
 * Note: Even though hardhat's compile task has a quiet option,
 * it stil prints some output. This is a hack to completely silence
 * output during deployment.
 * */
function _forceSilenceHardhat(silence, quiet) {
  if (!quiet) {
    return;
  }

  if (silence) {
    logCache = console.log;
    console.log = () => {};
  } else {
    console.log = logCache;
  }
}
