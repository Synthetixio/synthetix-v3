const { task } = require('hardhat/config');

const {
  SUBTASK_PICK_CONTRACT,
  SUBTASK_PICK_FUNCTION,
  SUBTASK_PRINT_INFO,
  TASK_INTERACT,
} = require('../task-names');
const { SUBTASK_LOAD_DEPLOYMENT } = require('@synthetixio/deployer/task-names');

const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const logger = require('@synthetixio/core-js/utils/logger');

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
    const escItem = '↩ BACK';

    await hre.run(SUBTASK_LOAD_DEPLOYMENT, { ...taskArguments, readOnly: true });
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);

    let contractFunction = escItem;
    while (contractFunction === escItem) {
      await hre.run(SUBTASK_PICK_CONTRACT, taskArguments);

      contractFunction = await hre.run(SUBTASK_PICK_FUNCTION, taskArguments);
    }
  });
