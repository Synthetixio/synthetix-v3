const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');
const createInitializer = require('./initializer');

module.exports = function bootstrap() {
  const { info, deploy, init } = createInitializer(hre);

  let snapshotId;

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async () => {
    await deploy({ clear: true });
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, hre.ethers.provider);
  });

  return { info, deploy, init };
};
