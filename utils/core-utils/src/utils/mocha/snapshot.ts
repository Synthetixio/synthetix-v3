import { ethers } from 'ethers';

export function snapshotCheckpoint(provider: () => ethers.providers.JsonRpcProvider) {
  let snapshotId: number;

  async function finaliseTxns() {
    const p = provider();
    const blockNumber = await p.getBlockNumber();
    const block = await p.getBlockWithTransactions(blockNumber);
    if (block?.transactions) {
      for await (const tx of block.transactions) {
        try {
          await tx.wait();
        } catch (e) {
          console.log('Leftover transaction', tx);
          console.error(e);
          // I really don't care if you fail or not
        }
      }
    }
  }

  before('snapshot', async () => {
    await finaliseTxns();
    snapshotId = await provider().send('evm_snapshot', []);
  });

  const restore = async () => {
    await finaliseTxns();
    await provider().send('evm_revert', [snapshotId]);

    // make a new snapshot
    snapshotId = await provider().send('evm_snapshot', []);
  };

  return restore;
}
