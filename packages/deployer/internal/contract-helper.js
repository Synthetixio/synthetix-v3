const { deployedContractHasBytescode } = require('@synthetixio/core-js/utils/contracts');

async function isAlreadyDeployed(contractPath, deploymentData) {
  if (!deploymentData.deployedAddress) {
    return false;
  }

  const artifactsPath = path.join(
    hre.config.paths.artifacts,
    contractPath,
    `${path.basename(contractPath, '.sol')}`
  );

  const contractArtifacts = JSON.parse(fs.readFileSync(artifactsPath));

  return deployedContractHasBytescode(
    deploymentData.deployedAddress,
    contractArtifacts.deployedBytecode
  );
}

module.exports = {
  isAlreadyDeployed,
};
