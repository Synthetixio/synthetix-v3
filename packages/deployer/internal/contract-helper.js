const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/contracts');

async function isAlreadyDeployed(contractName, deploymentData) {
  if (!deploymentData.deployedAddress) {
    return false;
  }

  const contractArtifacts = await hre.artifacts.readArtifact(contractName);

  return deployedContractHasBytescode(
    deploymentData.deployedAddress,
    contractArtifacts.deployedBytecode,
    hre.ethers.provider
  );
}

module.exports = {
  isAlreadyDeployed,
};
