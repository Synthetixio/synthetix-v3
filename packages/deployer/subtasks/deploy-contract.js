const path = require('path');
const logger = require('@synthetixio/core-js/utils/logger');
const { isAlreadyDeployed } = require('../internal/contract-helper');
const { getBytecodeHash } = require('@synthetixio/core-js/utils/contracts');
const { processTransaction, processReceipt } = require('../internal/process-transactions');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACT,
  'Deploys the given contract and update the contractData object.'
).setAction(async ({ contractPath, contractData, constructorArgs = [] }) => {
  if (await isAlreadyDeployed(contractPath, contractData)) {
    return false;
  }

  const contractName = path.basename(contractPath, '.sol');
  const contractArtifacts = await hre.artifacts.readArtifact(contractName);
  const sourceBytecodeHash = getBytecodeHash(contractArtifacts.deployedBytecode);

  // Create contract & start the transaction on the network
  const { contract, transaction } = await _createAndDeployContract(contractName, constructorArgs);

  contractData.deployedAddress = contract.address;
  contractData.deployTransaction = transaction.hash;
  contractData.bytecodeHash = sourceBytecodeHash;

  return true;
});

/**
 * Deploy the given contract using ethers.js
 */
async function _createAndDeployContract(contractName, constructorArgs = []) {
  logger.success(`Deploying ${contractName}`);

  const factory = await hre.ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...constructorArgs);

  if (!contract.address) {
    throw new Error(`Error deploying ${contractName}`);
  }

  const transaction = contract.deployTransaction;

  processTransaction(transaction, hre);
  const receipt = await hre.ethers.provider.getTransactionReceipt(transaction.hash);
  processReceipt(receipt, hre);

  return { contract, transaction };
}
