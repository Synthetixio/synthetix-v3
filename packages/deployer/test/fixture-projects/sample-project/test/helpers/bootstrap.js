const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');
const createInitializer = require('./initializer');

module.exports = function bootstrap() {
  const { deploymentInfo, deploySystem, initSystem } = createInitializer(hre);

  let snapshotId;

  before('take a snapshot', async function () {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async function () {
    await deploySystem({ clear: true });
  });

  after('restore the snapshot', async function () {
    await restoreSnapshot(snapshotId, hre.ethers.provider);
  });

  return { deploymentInfo, deploySystem, initSystem };
};
