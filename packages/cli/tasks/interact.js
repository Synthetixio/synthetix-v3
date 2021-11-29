const { task } = require('hardhat/config');

const { TASK_INTERACT, SUBTASK_PRINT_INFO, SUBTASK_LOAD_DEPLOYMENT } = require('../task-names');

const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const logger = require('@synthetixio/core-js/utils/logger');

task(TASK_INTERACT, 'Interacts with a given modular system deployment')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .setAction(async (taskArguments, hre) => {
    const { debug } = taskArguments;

    logger.debugging = debug;

    await hre.run(SUBTASK_LOAD_DEPLOYMENT, taskArguments);
    await hre.run(SUBTASK_PRINT_INFO, taskArguments);
  });
