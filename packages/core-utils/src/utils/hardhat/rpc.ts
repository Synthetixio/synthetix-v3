import { ethers } from 'ethers';

export async function takeSnapshot(provider: ethers.providers.JsonRpcProvider) {
  const snapshotId = await provider.send('evm_snapshot', []);

  await mineBlock(provider);

  return snapshotId;
}

export async function restoreSnapshot(snapshotId: any, provider: ethers.providers.JsonRpcProvider) {
  await provider.send('evm_revert', [snapshotId]);

  await mineBlock(provider);
}

export async function fastForward(seconds: number, provider: ethers.providers.JsonRpcProvider) {
  await provider.send('evm_increaseTime', [seconds]);

  await mineBlock(provider);
}

export async function fastForwardTo(time: number, provider: ethers.providers.JsonRpcProvider) {
  const now = await getTime(provider);

  if (time < now) {
    throw 'Cannot fast forward to a past date.';
  }

  await fastForward(time - now, provider);
}

export async function getTime(provider: ethers.providers.JsonRpcProvider) {
  const block = await provider.getBlock('latest');

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
