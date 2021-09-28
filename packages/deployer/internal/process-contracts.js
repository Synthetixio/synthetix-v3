const fs = require('fs/promises');
const path = require('path');
const { getContractAST } = require('@synthetixio/core-js/utils/hardhat');
const { getBytecodeHash } = require('@synthetixio/core-js/utils/contracts');
const { findInheritedContractNames } = require('@synthetixio/core-js/utils/ast');
const { contractIsModule } = require('./contract-helper');

/**
 * Initialize contract metadata on hre.deployer.deployment.*
 * This will in turn save all the necessary data to deployments file.
 * @param {string} contractName
 */
async function initContractData(contractName) {
  const { deployment, previousDeployment } = hre.deployer;

  const { sourceName, abi, deployedBytecode } = await hre.artifacts.readArtifact(contractName);

  const previousData = previousDeployment?.general.contracts[contractName] || {};
  const isModule = contractIsModule(sourceName);
  const deployedBytecodeHash = getBytecodeHash(deployedBytecode);

  const generalData = {
    deployedAddress: '',
    deployTransaction: '',
    ...previousData,
    deployedBytecodeHash,
    sourceName,
  };

  if (isModule) {
    generalData.isModule = true;
  }

  deployment.general.contracts[contractName] = generalData;
  deployment.abis[contractName] = abi;

  await initContractSource(contractName);
}

/**
 * Save contract sources, AST and bytcode to deployment files. Kept for maintaining
 * historic data.
 * @param {string} contractName
 */
async function initContractSource(contractName) {
  const { deployment } = hre.deployer;

  // If the contract sources are already calculated, don't re do it.
  if (deployment.sources[contractName]) {
    return;
  }

  const { sourceName, bytecode, deployedBytecode } = await hre.artifacts.readArtifact(contractName);

  const ast = await getContractAST({ sourceName, contractName, hre });
  const sourceCode = (
    await fs.readFile(path.resolve(hre.config.paths.root, sourceName))
  ).toString();

  deployment.sources[contractName] = {
    bytecode,
    deployedBytecode,
    sourceCode,
    ast,
  };

  // Also init all the sources from the inherited contracts
  for (const contractName of findInheritedContractNames(ast)) {
    await initContractSource(contractName);
  }
}

module.exports = {
  initContractData,
  initContractSource,
};
