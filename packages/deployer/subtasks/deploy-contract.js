const logger = require('@synthetixio/core-js/utils/logger');
const { isAlreadyDeployed } = require('../internal/contract-helper');
const { processTransaction, processReceipt } = require('../internal/process-transactions');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACT,
  'Deploys the given contract and update the contractData object.'
).setAction(async ({ contractName, constructorArgs = [] }) => {
  const contractData = hre.deployer.deployment.general.contracts[contractName];

  if (!contractData) {
    throw new Error(`Cotract ${contractName} cannot be deployed because is not initialized.`);
  }

  if (await isAlreadyDeployed(contractName, contractData)) {
    return false;
  }

  // Create contract & start the transaction on the network
  const { contract, transaction } = await _createAndDeployContract(contractName, constructorArgs);

  contractData.deployedAddress = contract.address;
  contractData.deployTransaction = transaction.hash;

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
