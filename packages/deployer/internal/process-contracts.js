const fs = require('fs/promises');
const path = require('path');
const { contractIsModule } = require('./contract-helper');
const { getContractAST } = require('@synthetixio/core-js/utils/hardhat');
const { getBytecodeHash } = require('@synthetixio/core-js/utils/contracts');

/**
 * Initialize contract metadata on hre.deployer.deployment.*
 * This will in turn save all the necessary data to deployments file.
 * @param {string} contractName
 */
async function initContractData(contractName) {
  const { deployment, previousDeployment } = hre.deployer;
  const { sourceName, abi, bytecode, deployedBytecode } = await hre.artifacts.readArtifact(
    contractName
  );

  const previousData = previousDeployment?.general.contracts[contractName] || {};
  const isModule = contractIsModule(sourceName);
  const deployedBytecodeHash = getBytecodeHash(deployedBytecode);
  const ast = await getContractAST({ sourceName, contractName });
  const sourceCode = (
    await fs.readFile(path.resolve(hre.config.paths.root, sourceName))
  ).toString();

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
  deployment.sources[contractName] = {
    bytecode,
    deployedBytecode,
    sourceCode,
    ast,
  };
}

module.exports = {
  initContractData,
};
