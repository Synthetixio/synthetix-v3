const { task } = require('hardhat/config');

const { TASK_INTERACT } = require('../task-names');

task(TASK_INTERACT, 'Interacts with a given Synthetix deployment')
  .addFlag('useFork', 'Use a local fork')
  .addFlag('useOvm', 'Use an Optimism chain')
  .addOptionalParam('targetNetwork', 'Target the instance deployed in this network', 'mainnet')
  .addOptionalParam('gasLimit', 'Max gas to use when signing transactions', '8000000')
  .addOptionalParam('privateKey', 'Private key to use to sign txs')
  .addOptionalParam('providerUrl', 'The http provider to use for communicating with the blockchain')
  .addOptionalParam('deploymentPath', 'Specify the path to the deployment data directory')
  .setAction(async (taskArguments, hre) => {
    const { useOvm, useFork, deploymentPath, targetNetwork } = taskArguments;
    let { providerUrl, gasLimit, privateKey } = taskArguments;
  });
