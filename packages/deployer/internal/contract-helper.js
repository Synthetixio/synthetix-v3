const fs = require('fs');
const path = require('path');
const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/contracts');

async function isAlreadyDeployed(contractPath, deploymentData) {
  if (!deploymentData.deployedAddress) {
    return false;
  }

  const contractName = path.basename(contractPath, '.sol');
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
