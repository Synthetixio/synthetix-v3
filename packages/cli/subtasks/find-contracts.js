const { subtask } = require('hardhat/config');
const { SUBTASK_FIND_CONTRACTS } = require('../task-names');

/**
 * Get the list of contracts that can be interacted with
 * @returns {{
 *   contractName: string,
 *   contractFullyQualifiedName: string,
 *   contractDeployedAddress: string
 * }[]}
 */
subtask(SUBTASK_FIND_CONTRACTS, 'Get the list of contracts that can be interacted with').setAction(
  async (_, hre) => {
    return _getDeploymentContracts(hre);
  }
);

function _getDeploymentContracts(hre) {
  return Object.values(hre.router.deployment.general.contracts).map((artifact) => ({
    contractName: artifact.contractName,
    contractFullyQualifiedName: artifact.contractFullyQualifiedName,
    contractDeployedAddress: artifact.isModule ? artifact.proxyAddress : artifact.deployedAddress,
  }));
}
