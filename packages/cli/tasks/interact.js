const { task } = require('hardhat/config');
const {
  TASK_INTERACT,
  SUBTASK_PRINT_INFO,
  SUBTASK_PICK_CONTRACT,
  SUBTASK_PICK_FUNCTION,
  SUBTASK_PICK_PARAMETERS,
  SUBTASK_EXECUTE_CALL,
} = require('../task-names');
const { SUBTASK_LOAD_DEPLOYMENT } = require('@synthetixio/deployer/task-names');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const logger = require('@synthetixio/core-js/utils/logger');
const inquirer = require('inquirer');
const autocomplete = require('inquirer-list-search-prompt');

task(TASK_INTERACT, 'Interacts with a given modular system deployment')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addFlag('debug', 'Display debug logs', false)
  .setAction(async (taskArguments, hre) => {
    const { debug } = taskArguments;

    inquirer.registerPrompt('autocomplete', autocomplete);

    logger.debugging = debug;

    await hre.run(SUBTASK_LOAD_DEPLOYMENT, { ...taskArguments, readOnly: true });
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);

    async function run() {
      let subtask, clear;

      if (!hre.cli.contractName) {
        subtask = SUBTASK_PICK_CONTRACT;
      } else if (!hre.cli.functionName) {
        subtask = SUBTASK_PICK_FUNCTION;
      } else if (!hre.cli.functionParameters) {
        subtask = SUBTASK_PICK_PARAMETERS;
      } else {
        subtask = SUBTASK_EXECUTE_CALL;
        clear = true;
      }

      await hre.run(subtask, taskArguments);

      if (clear) {
        hre.cli.functionParameters = null;
        hre.cli.functionName = null;
        hre.cli.contractName = null;
      }

      await run();
    }

    await run();
  });
