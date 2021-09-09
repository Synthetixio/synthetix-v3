function processTransaction(transaction, hre) {
  hre.deployer.data.transactions[transaction.hash] = { status: 'pending' };
}

function processReceipt(receipt, hre) {
  // Wait for the transaction to finish
  const { gasUsed } = receipt;
  const status = receipt.status === 1 ? 'confirmed' : 'failed';

  hre.deployer.data.transactions[receipt.transactionHash].status = status;

  const totalGasUsed = hre.ethers.BigNumber.from(hre.deployer.data.properties.totalGasUsed)
    .add(gasUsed)
    .toString();

  hre.deployer.data.properties.totalGasUsed = totalGasUsed;

  return { status, gasUsed };
}

module.exports = {
  processTransaction,
  processReceipt,
};
