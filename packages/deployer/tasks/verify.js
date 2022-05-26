const { task } = require('hardhat/config');

const { TASK_DEPLOY_VERIFY } = require('../task-names');

const logger = require('@synthetixio/core-js/utils/io/logger');
const prompter = require('@synthetixio/core-js/utils/io/prompter');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');

task(TASK_DEPLOY_VERIFY, 'Verify deployment contracts using Etherscan API')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addOptionalParam(
    'deployment',
    'The deployment to verify, defaults to latest',
    undefined,
    types.alphanumeric
  )
  .setAction(async (taskArguments, hre) => {
    // Verify deployment
  });
