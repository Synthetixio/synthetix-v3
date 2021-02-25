const logger = require('./logger');

function processTransaction({ transaction }) {
  logger.info(`Transaction hash: ${transaction.hash}`);
  logger.debug(`Transaction: ${JSON.stringify(transaction, null, 2)}`);
}

function processReceipt({ receipt, hre }) {
  logger.debug(`Receipt: ${JSON.stringify(receipt, null, 2)}`);

  const totalGasUsed = hre.ethers.BigNumber.from(hre.deployer.data.properties.totalGasUsed).add(
    receipt.gasUsed
  );

  logger.info(`Gas used: ${receipt.gasUsed} (Total: ${totalGasUsed})`);

  hre.deployer.data.properties.totalGasUsed = totalGasUsed.toString();
}

module.exports = {
  processTransaction,
  processReceipt,
};
