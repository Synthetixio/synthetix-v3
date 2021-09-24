const fs = require('fs/promises');
const path = require('path');

const { getContractAST } = require('@synthetixio/core-js/utils/hardhat');

/**
 * Initialize contract metadata on hre.deployer.deployment.*
 * @param {string} contractName
 * @param {object} [general={}] initial contract metadata, e.g.: { isModule: true }
 */
async function initContractData(contractName, general = {}) {
  const { deployment, previousDeployment } = hre.deployer;
  const { sourceName, abi, bytecode, deployedBytecode } = await hre.artifacts.readArtifact(
    contractName
  );

  const sourceCode = (
    await fs.readFile(path.resolve(hre.config.paths.root, sourceName))
  ).toString();

  const ast = await getContractAST({ sourceName, contractName });

  const previousData = previousDeployment?.general.contracts[contractName] || {};

  deployment.general.contracts[contractName] = {
    deployedAddress: '',
    deployTransaction: '',
    bytecodeHash: '',
    ...previousData,
    ...general,
    sourceName,
  };

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
