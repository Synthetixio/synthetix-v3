const logger = require('@synthetixio/core-js/utils/logger');

async function processTransaction(transaction, hre) {
  logger.info(`Processing transaction ${transaction.hash}...`);

  hre.deployer.deployment.general.transactions[transaction.hash] = { status: 'pending' };

  const receipt = await transaction.wait();

  const { gasUsed } = receipt;
  const status = receipt.status === 1 ? 'confirmed' : 'failed';

  if (status === 1) {
    throw new Error('Transaction reverted', receipt);
  } else {
    logger.checked(`Transaction successful with gas ${gasUsed}`);
  }

  hre.deployer.deployment.general.transactions[transaction.hash].status = status;

  const totalGasUsed = hre.ethers.BigNumber.from(
    hre.deployer.deployment.general.properties.totalGasUsed
  )
    .add(gasUsed)
    .toString();

  hre.deployer.deployment.general.properties.totalGasUsed = totalGasUsed;

  return receipt;
}

module.exports = {
  processTransaction,
};
