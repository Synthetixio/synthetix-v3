const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const {
  getContractNameFromPath,
  getContractBytecodeHash,
  getAddressBytecodeHash,
} = require('../utils/contracts');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_CONTRACTS } = require('../task-names');

subtask(
  SUBTASK_DEPLOY_CONTRACTS,
  'Deploys a list of contracts, avoiding contracts that do not need to be compiled, and prompting the user for confirmation.'
).setAction(async ({ contracts }, hre) => {
  const { toSkip, toUpdate, toCreate } = await _processContracts(contracts);

  if (toUpdate.length === 0 && toCreate.length === 0) {
    logger.info('No contracts need to be deployed, continuing...');
    return;
  } else {
    await _confirmDeployments({ toSkip, toUpdate, toCreate });
  }

  // Update & create the contracts
  for (const [contractPath, contractData] of [...toUpdate, ...toCreate]) {
    const contractName = getContractNameFromPath(contractPath);
    const sourceBytecodeHash = getContractBytecodeHash(contractPath);

    // Create contract & start the transaction on the network
    const { contract, transaction } = await _createAndDeployContract(contractName);

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
  }
});

/**
 * Prompts the user to confirm the give deployments if necessary
 */
async function _confirmDeployments({ toSkip, toUpdate, toCreate }) {
  if (toSkip.length > 0) {
    logger.info(`There are ${toSkip.length} contracts that are already up-to-date:`);
    toSkip.forEach(([source]) => logger.notice(`  ${source}`));
  }

  if (toUpdate.length > 0) {
    logger.info(`The following ${toUpdate.length} contracts are going to be updated:`);
    toUpdate.forEach(([source]) => logger.notice(`  ${source}`));
  }

  if (toCreate.length > 0) {
    logger.info(
      `The following ${toCreate.length} contracts are going to be deployed for the first time:`
    );
    toCreate.forEach(([source]) => logger.notice(`  ${source}`));
  }

  await prompter.confirmAction('Are you sure you want to make these changes?');
}

/**
 * Sort contracts by the ones that doesn't need deployment, the ones that are going
 * to be re-deployed with updated code, and the ones that are going to be deployed
 * for the first time.
 */
async function _processContracts(contracts) {
  const toSkip = [];
  const toUpdate = [];
  const toCreate = [];

  for (const [contractPath, contractData] of Object.entries(contracts)) {
    if (hre.network.name === 'hardhat' || !contractData.deployedAddress) {
      toCreate.push([contractPath, contractData]);
    } else {
      const sourceBytecodeHash = getContractBytecodeHash(contractPath);
      const remoteBytecodeHash = await getAddressBytecodeHash(contractData.deployedAddress);

      if (sourceBytecodeHash === remoteBytecodeHash) {
        toSkip.push([contractPath, contractData]);
      } else {
        toUpdate.push([contractPath, contractData]);
      }
    }
  }

  return { toSkip, toUpdate, toCreate };
}

/**
 * Deploy the given contract using ethers.js
 */
async function _createAndDeployContract(contractName) {
  logger.success(`Deploying ${contractName}`);

  const factory = await hre.ethers.getContractFactory(contractName);
  const contract = await factory.deploy();

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
