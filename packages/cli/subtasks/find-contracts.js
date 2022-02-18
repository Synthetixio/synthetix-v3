const { subtask } = require('hardhat/config');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const {
  findImportedContractFullyQualifiedName,
  findContractDependencies,
} = require('@synthetixio/core-js/utils/ast/finders');
const { capitalize } = require('@synthetixio/core-js/utils/misc/strings');
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
    const deploymentContracts = _getDeploymentContracts(hre);
    const satellites = await _getSatellites(hre);

    return [...deploymentContracts, ...satellites];
  }
);

function _getDeploymentContracts(hre) {
  return Object.values(hre.deployer.deployment.general.contracts).map((artifact) => ({
    contractName: artifact.contractName,
    contractFullyQualifiedName: artifact.contractFullyQualifiedName,
    contractDeployedAddress: artifact.isModule ? artifact.proxyAddress : artifact.deployedAddress,
  }));
}

async function _getSatellites(hre) {
  const satellites = [];

  const sources = hre.deployer.deployment.sources;
  const modulesArtifacts = Object.values(hre.deployer.deployment.general.contracts).filter(
    ({ isModule }) => isModule
  );

  for (const { contractFullyQualifiedName, proxyAddress } of modulesArtifacts) {
    const { sourceName, contractName } = parseFullyQualifiedName(contractFullyQualifiedName);
    const baseAstNode = hre.deployer.deployment.sources[sourceName].ast;
    const astNodes = Object.values(sources).map((source) => source.ast);

    const dependencies = findContractDependencies(contractFullyQualifiedName, astNodes).map(
      (fqName) => parseFullyQualifiedName(fqName).contractName
    );

    // Check if the contract can create Satellites
    if (!dependencies.some((name) => name === 'SatelliteFactory')) {
      continue;
    }

    // Ask the Satellite Factory contract if it already deployed any Satellites
    const abi = hre.deployer.deployment.abis[contractFullyQualifiedName];
    const contract = new hre.ethers.Contract(proxyAddress, abi, hre.ethers.provider);
    const results = await contract[`get${capitalize(contractName)}Satellites`]();

    if (results.length === 0) {
      continue;
    }

    // Find for the fully qualified names of the created Satellites, and add them
    // to the PICK CONTRACT choices.
    for (const result of results) {
      const satelliteName = hre.ethers.utils.parseBytes32String(result.name);
      const satelliteLocalContractName = hre.ethers.utils.parseBytes32String(result.contractName);

      const satelliteFullyQualifiedName = findImportedContractFullyQualifiedName(
        satelliteLocalContractName,
        baseAstNode,
        astNodes
      );

      satellites.push({
        contractName: satelliteName,
        contractFullyQualifiedName: satelliteFullyQualifiedName,
        contractDeployedAddress: result.deployedAddress,
      });
    }
  }

  return satellites;
}
