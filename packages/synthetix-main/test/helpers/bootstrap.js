const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');
const createInitializer = require('./initializer');

module.exports = function bootstrap() {
  const { deploymentInfo, deploySystem, initSystem } = createInitializer(hre);

  let snapshotId;

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async () => {
    await deploySystem({ clear: true });
  });

  before('initialize system', async () => {
    await initSystem();
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, hre.ethers.provider);
  });

  return { deploymentInfo, deploySystem, initSystem };
};
