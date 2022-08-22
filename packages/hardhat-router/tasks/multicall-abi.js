const { task } = require('hardhat/config');
const types = require('@synthetixio/core-utils/dist/utils/hardhat/argument-types');
const {
  TASK_DEPLOY_MULTICALL_ABI,
  SUBTASK_GET_DEPLOYMENT_INFO,
  SUBTASK_GET_MULTICALL_ABI,
} = require('../task-names');

task(
  TASK_DEPLOY_MULTICALL_ABI,
  'Generate a single merged ABI of the Proxy, including all the Modules ABIs'
)
  .addFlag('quiet', 'if you do not want the result to be not printed to the console')
  .addOptionalParam(
    'instance',
    'The name of the target instance for deployment',
    'official',
    types.alphanumeric
  )
  .addOptionalParam('include', 'optional comma separated modules to include', '')
  .setAction(async ({ quiet, instance, include }, hre) => {
    const whitelist = include
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const info = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO, { instance });
    const abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info, whitelist });

    const result = { abi };

    if (!quiet) {
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  });
