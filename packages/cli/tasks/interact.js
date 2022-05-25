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
const logger = require('@synthetixio/core-js/utils/io/logger');

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

    logger.debugging = debug;

    await hre.run(SUBTASK_LOAD_DEPLOYMENT, { ...taskArguments, readOnly: true });
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);

    let help = 'USAGE:\n';
    help += '* Use arrows to navigate, or type to autocomplete\n';
    help += '* Press enter to select a choice\n';
    help += '* Press ctrl-c to go back and exit\n';
    help += '* For bytes32 types, strings will be utf converted\n';
    help += '* For address types, self/signer will use signer address\n';
    logger.info(help, '\n');

    async function run() {
      let subtask;

      if (!hre.cli.contractFullyQualifiedName) {
        subtask = SUBTASK_PICK_CONTRACT;
      } else if (!hre.cli.functionAbi) {
        subtask = SUBTASK_PICK_FUNCTION;
      } else if (!hre.cli.functionParameters) {
        subtask = SUBTASK_PICK_PARAMETERS;
      } else {
        subtask = SUBTASK_EXECUTE_CALL;
      }

      await hre.run(subtask, taskArguments);

      await run();
    }

    await run();
  });
