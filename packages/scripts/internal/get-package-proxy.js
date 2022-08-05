const path = require('path');
const { SUBTASK_GET_MULTICALL_ABI } = require('@synthetixio/deployer/task-names');
const { getDeployment } = require('@synthetixio/deployer/utils/deployments');

/**
 * Load the Proxy contract using the complete ABI from all the Modules of the given package.
 * @param {HardhatEnvironment} hre
 * @param {string} packageName
 * @param {string} [instance="official"]
 */
module.exports = async function getPackageProxy(hre, packageName, instance = 'official') {
  const info = {
    network: hre.network.name,
    instance,
    folder: path.join(__dirname, '..', '..', packageName, 'deployments'),
  };

  const deployment = getDeployment(info);

  if (!deployment) {
    throw new Error(
      `Package "${packageName}" does not have the deployment "${hre.network.name}/${instance}"`
    );
  }

  const { deployedAddress } = Object.values(deployment.contracts).find((c) => c.isProxy);

  const abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });
  return await hre.ethers.getContractAt(abi, deployedAddress);
};
