const fs = require('fs/promises');
const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { getBytecodeHash } = require('@synthetixio/core-js/utils/ethers/contracts');
const { findInheritedContractNames } = require('@synthetixio/core-js/utils/ast/finders');
const { getContractFilePath } = require('./contract-helper');

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

  const { sourceName, bytecode, deployedBytecode } = await hre.artifacts.readArtifact(
    contractFullyQualifiedName
  );
  const buildInfo = await hre.artifacts.getBuildInfo(contractFullyQualifiedName);

  const ast = buildInfo.output.sources[sourceName].ast;
  const sourceCode = (await fs.readFile(getContractFilePath(sourceName))).toString();

  deployment.sources[contractFullyQualifiedName] = {
    bytecode,
    deployedBytecode,
    sourceCode,
    ast,
  };

  // Also init all the sources from the inherited contracts
  for (const contractName of findInheritedContractNames(ast)) {
    const { sourceName } = await hre.artifacts.readArtifact(contractName);
    await _initContractSource(`${sourceName}:${contractName}`);
  }
}

module.exports = {
  initContractData,
};
