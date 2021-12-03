const { task } = require('hardhat/config');
const {
  TASK_INTERACT,
  SUBTASK_PRINT_INFO,
  SUBTASK_PICK_CONTRACT,
  SUBTASK_PICK_FUNCTION,
  SUBTASK_PICK_PARAMETERS,
  SUBTASK_PREVIEW_CALL,
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

    const taskLinks = {};
    taskLinks[SUBTASK_PICK_CONTRACT] = {
      completed: () => hre.cli.contractName !== null,
      previousSubtask: null,
      nextSubtask: SUBTASK_PICK_FUNCTION,
    };
    taskLinks[SUBTASK_PICK_FUNCTION] = {
      completed: () => hre.cli.functionName !== null,
      previousSubtask: SUBTASK_PICK_CONTRACT,
      nextSubtask: SUBTASK_PICK_PARAMETERS,
    };
    taskLinks[SUBTASK_PICK_PARAMETERS] = {
      completed: () => hre.cli.functionParameters !== null,
      previousSubtask: SUBTASK_PICK_FUNCTION,
      nextSubtask: SUBTASK_PREVIEW_CALL,
    };
    taskLinks[SUBTASK_PREVIEW_CALL] = {
      completed: () => hre.cli.callConfirmed === true,
      previousSubtask: SUBTASK_PICK_FUNCTION,
      nextSubtask: SUBTASK_EXECUTE_CALL,
    };
    taskLinks[SUBTASK_EXECUTE_CALL] = {
      completed: () => true,
      previousSubtask: SUBTASK_PICK_FUNCTION,
      nextSubtask: SUBTASK_PICK_FUNCTION,
    };

    async function runSubtask(subtask) {
      await hre.run(subtask, taskArguments);

      const link = taskLinks[subtask];
      const nextSubtask = link.completed() ? link.nextSubtask : link.previousSubtask;

      await runSubtask(nextSubtask);
    }

    await runSubtask(SUBTASK_PICK_CONTRACT);
  });
