function processTransaction(transaction, hre) {
  hre.deployer.deployment.general.transactions[transaction.hash] = { status: 'pending' };
}

function processReceipt(receipt, hre) {
  const { gasUsed } = receipt;
  const status = receipt.status === 1 ? 'confirmed' : 'failed';

  hre.deployer.deployment.general.transactions[receipt.transactionHash].status = status;

  const totalGasUsed = hre.ethers.BigNumber.from(
    hre.deployer.deployment.general.properties.totalGasUsed
  )
    .add(gasUsed)
    .toString();

  hre.deployer.deployment.general.properties.totalGasUsed = totalGasUsed;

  return { status, gasUsed };
}

module.exports = {
  processTransaction,
  processReceipt,
};
