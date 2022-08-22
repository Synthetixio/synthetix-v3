const { default: logger } = require('@synthetixio/core-js/dist/utils/io/logger');

async function processTransaction({ transaction, description, hre }) {
  logger.info(`Processing transaction ${transaction.hash}...`);

  hre.router.deployment.general.transactions[transaction.hash] = { status: 'pending' };

  const receipt = await transaction.wait();

  const { gasUsed } = receipt;
  const status = receipt.status === 1 ? 'confirmed' : 'failed';

  const tx = hre.router.deployment.general.transactions[transaction.hash];
  tx.status = status;
  tx.block = await hre.ethers.provider.getBlockNumber();
  if (description) {
    tx.description = description;
  }

  const totalGasUsed = hre.ethers.BigNumber.from(
    hre.router.deployment.general.properties.totalGasUsed
  )
    .add(gasUsed)
    .toString();

  hre.router.deployment.general.properties.totalGasUsed = totalGasUsed;

  if (status === 1) {
    // Do not allow execution to continue when a tx is mined, but reverts.
    throw new Error('Transaction reverted', receipt);
  } else {
    logger.checked(`Transaction successful with gas ${gasUsed}`);
  }

  return receipt;
}

module.exports = {
  processTransaction,
};
