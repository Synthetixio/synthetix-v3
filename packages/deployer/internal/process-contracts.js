const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { getBytecodeHash } = require('@synthetixio/core-js/utils/ethers/contracts');

/**
 * Initialize contract metadata on hre.deployer.deployment.*
 * This will in turn save all the necessary data to deployments file.
 * @param {string} contractFullyQualifiedName
 */
async function initContractData(contractFullyQualifiedName, extraData = {}) {
  const { deployment, previousDeployment } = hre.deployer;

  const { sourceName, contractName } = parseFullyQualifiedName(contractFullyQualifiedName);
  const { abi, deployedBytecode } = await hre.artifacts.readArtifact(contractFullyQualifiedName);

  const previousData = previousDeployment?.general.contracts[contractFullyQualifiedName] || {};
  const deployedBytecodeHash = getBytecodeHash(deployedBytecode);

  deployment.general.contracts[contractFullyQualifiedName] = {
    deployedAddress: '',
    deployTransaction: '',
    ...previousData,
    ...extraData,
    deployedBytecodeHash,
    contractFullyQualifiedName,
    contractName,
    sourceName,
  };

  deployment.abis[contractFullyQualifiedName] = abi;

  await _initContractSource(contractFullyQualifiedName);
}

/**
 * Save contract sources, AST and bytcode to deployment files. Kept for maintaining
 * historic data.
 * @param {string} contractFullyQualifiedName
 */
async function _initContractSource(contractFullyQualifiedName) {
  const { deployment } = hre.deployer;

  // If the contract sources are already calculated, don't re do it.
  if (deployment.sources[contractFullyQualifiedName]) {
    return;
  }

  const buildInfo = await hre.artifacts.getBuildInfo(contractFullyQualifiedName);

  // Save the source code for the entire dependency tree
  for (const [sourceName, attributes] of Object.entries(buildInfo.input.sources)) {
    if (!deployment.sources[sourceName]) {
      deployment.sources[sourceName] = {};
    }

    deployment.sources[sourceName].sourceCode = attributes.content;
  }

  // Save the asts for the entire dependency tree
  for (const [sourceName, attributes] of Object.entries(buildInfo.output.sources)) {
    deployment.sources[sourceName].ast = attributes.ast;
  }
}

module.exports = {
  initContractData,
};
