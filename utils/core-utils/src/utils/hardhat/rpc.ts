import { ethers } from 'ethers';

export async function takeSnapshot(provider: ethers.providers.JsonRpcProvider) {
  const snapshotId = (await provider.send('evm_snapshot', [])) as string;

  await mineBlock(provider);

  return snapshotId;
}

export async function restoreSnapshot(
  snapshotId: string,
  provider: ethers.providers.JsonRpcProvider
) {
  await provider.send('evm_revert', [snapshotId]);

  await mineBlock(provider);
}

export async function fastForward(seconds: number, provider: ethers.providers.JsonRpcProvider) {
  await provider.send('evm_increaseTime', [seconds]);

  await mineBlock(provider);
}

export async function fastForwardTo(time: number, provider: ethers.providers.JsonRpcProvider) {
  await provider.send('evm_setNextBlockTimestamp', [time]);
  await mineBlock(provider);
}

export async function getTime(provider: ethers.providers.JsonRpcProvider) {
  const block = await provider.getBlock('latest');

  return block.timestamp;
}

export async function getTxTime(
  provider: ethers.providers.JsonRpcProvider,
  tx: ethers.ContractTransaction
) {
  let txReceipt = null;
  let counter = 0;
  while (txReceipt == null) {
    txReceipt = await provider.getTransactionReceipt(tx.hash);
    if (txReceipt == null) {
      counter = counter + 1;
      console.log(`Waiting for receipt ${tx.hash}... ${counter * 10} ms`);
      await new Promise((f) => setTimeout(f, 10));
    }
  }
  if (counter > 0) {
    console.log(`Got receipt ${tx.hash} after ${counter * 10} ms`);
  }

  const block = await provider.getBlock(txReceipt.blockNumber);

  return block.timestamp;
}

export async function getBlock(provider: ethers.providers.JsonRpcProvider) {
  const block = await provider.getBlock('latest');

  return block.number;
}

export async function advanceBlock(provider: ethers.providers.JsonRpcProvider) {
  await mineBlock(provider);
}

export async function mineBlock(provider: ethers.providers.JsonRpcProvider) {
  await provider.send('evm_mine', []);
}
