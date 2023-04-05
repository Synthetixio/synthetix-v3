const path = require('path');
const { SUBTASK_GET_MULTICALL_ABI } = require('@synthetixio/deployer/task-names');
const { getDeployment } = require('@synthetixio/deployer/utils/deployments');

/**
 * @param {HardhatEnvironment} hre
 * @param {string} packageName
 * @param {string} [instance="official"]
 */
function getPackageInfo(hre, packageName, instance = 'official') {
  return {
    network: hre.network.name,
    instance,
    folder: path.join(__dirname, '..', '..', packageName, 'deployments'),
  };
}

/**
 * @param {HardhatEnvironment} hre
 * @param {string} packageName
 * @param {string} [instance="official"]
 */
function getPackageDeployment(hre, packageName, instance = 'official') {
  const info = getPackageInfo(hre, packageName, instance);
  const deployment = getDeployment(info);

  if (!deployment) {
    throw new Error(
      `Package "${packageName}" does not have the deployment "${hre.network.name}/${instance}"`
    );
  }

  return deployment;
}

/**
 * Load the Proxy contract using the complete ABI from all the Modules of the given package.
 * @param {HardhatEnvironment} hre
 * @param {string} packageName
 * @param {string} [instance="official"]
 */
async function getPackageProxy(hre, packageName, instance = 'official') {
  const info = getPackageInfo(hre, packageName, instance);
  const deployment = getPackageDeployment(hre, packageName, instance);

  const { deployedAddress } = Object.values(deployment.contracts).find((c) => c.isProxy);

  const abi = await hre.run(SUBTASK_GET_MULTICALL_ABI, { info });
  return await hre.ethers.getContractAt(abi, deployedAddress);
}

module.exports = {
  getPackageInfo,
  getPackageDeployment,
  getPackageProxy,
};
