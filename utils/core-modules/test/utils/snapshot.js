function snapshotCheckpoint(provider) {
  let snapshotId;

  before('snapshot', async () => {
    snapshotId = await provider().send('evm_snapshot', []);
  });

  const restore = async () => {
    await provider().send('evm_revert', [snapshotId]);
    snapshotId = await provider().send('evm_snapshot', []);
  };

  return restore;
}

module.exports = {
  snapshotCheckpoint,
};
