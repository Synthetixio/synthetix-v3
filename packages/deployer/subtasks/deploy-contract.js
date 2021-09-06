const logger = require('../utils/logger');
const { getContractNameFromPath, getContractBytecodeHash } = require('../utils/contracts');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACT,
  'Deploys the given contract and update the contractData object.'
).setAction(async ({ contractPath, contractData, constructorArgs = [] }, hre) => {
  const contractName = getContractNameFromPath(contractPath);
  const sourceBytecodeHash = getContractBytecodeHash(contractPath);

  // Create contract & start the transaction on the network
  const { contract, transaction } = await _createAndDeployContract(contractName, constructorArgs);

  hre.deployer.data.transactions[transaction.hash] = { status: 'pending' };

  // Wait for the transaction to finish
  const { gasUsed, status } = await _waitForTransaction(transaction);

  hre.deployer.data.transactions[transaction.hash].status = status;

  const totalGasUsed = hre.ethers.BigNumber.from(hre.deployer.data.properties.totalGasUsed)
    .add(gasUsed)
    .toString();
  hre.deployer.data.properties.totalGasUsed = totalGasUsed;

  contractData.deployedAddress = contract.address;
  contractData.deployTransaction = transaction.hash;
  contractData.bytecodeHash = sourceBytecodeHash;
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

  return { contract, transaction: contract.deployTransaction };
}

/**
 * Given a transaction, wait for it to finish and return the state with the gas used.
 */
async function _waitForTransaction(transaction) {
  const receipt = await hre.ethers.provider.getTransactionReceipt(transaction.hash);
  const { gasUsed } = receipt;
  const status = receipt.status === 1 ? 'confirmed' : 'failed';

  logger.info(`Transaction hash: ${transaction.hash}`);
  logger.info(`Status: ${status} - Gas used: ${gasUsed}`);

  return { gasUsed, status };
}
