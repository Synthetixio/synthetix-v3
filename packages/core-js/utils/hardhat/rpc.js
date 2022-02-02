async function takeSnapshot(provider) {
  const snapshotId = await provider.send('evm_snapshot', []);

  await mineBlock(provider);

  return snapshotId;
}

async function restoreSnapshot(snapshotId, provider) {
  await provider.send('evm_revert', [snapshotId]);

  await mineBlock(provider);
}

async function fastForward(seconds, provider) {
  await provider.send('evm_increaseTime', [seconds]);

  await mineBlock(provider);
}

async function fastForwardTo(time, provider) {
  const now = await getTime(provider);

  if (time < now) {
    throw 'Cannot fast forward to a past date.';
  }

  await fastForward(time - now, provider);
}

async function getTime(provider) {
  const block = await provider.getBlock();

  return block.timestamp;
}

async function mineBlock(provider) {
  await provider.send('evm_mine');
}

module.exports = {
  takeSnapshot,
  restoreSnapshot,
  fastForward,
  fastForwardTo,
  getTime,
};
