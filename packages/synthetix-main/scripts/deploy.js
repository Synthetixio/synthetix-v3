const hre = require('hardhat');
const { getDeployment, getDeploymentAbis } = require('@synthetixio/deployer/utils/deployments');
const {
  TASK_DEPLOY,
  SUBTASK_GET_MULTICALL_ABI,
  SUBTASK_GET_DEPLOYMENT_INFO,
} = require('@synthetixio/deployer/task-names');

/**
 * Generate the file contracts/Router.sol including the given modules in its source.
 */
module.exports.deploy = async function deploy() {
  const isHHNetwork = hre.network.name === 'hardhat';
  await hre.run(TASK_DEPLOY, { noConfirm: true, quiet: false, clear: isHHNetwork });

  const info = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO);

  // deployer leaves its result in JSON files.
  const deployment = getDeployment(info);
  const abis = getDeploymentAbis(info);

  const contracts = Object.values(deployment.contracts).reduce((contracts, c) => {
    if (contracts[c.contractName]) {
      throw new Error(`Contract name repeated: "${c.contractName}"`);
    }

    contracts[c.contractName] = {
      address: c.deployedAddress,
      abi: abis[c.contractFullyQualifiedName],
      deployTxnHash: c.deployTransaction,
    };

    return contracts;
  }, {});

  // Rename Synthetix to Proxy
  contracts.Proxy = contracts.Synthetix;
  delete contracts.Synthetix;

  // Set the multicall ABI on the Proxy
  contracts.Proxy.abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });

  return {
    contracts,
  };
};

if (module == require.main) {
  module.exports.deploy().then(console.log);
}
