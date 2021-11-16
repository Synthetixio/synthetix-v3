const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');

const { ethers } = hre;

module.exports = function bootstrap() {
  const deploymentInfo = {
    network: 'hardhat',
    instance: 'test',
  };

  let snapshotId;

  before('take a snapshot', async function () {
    snapshotId = await takeSnapshot(ethers.provider);
  });

  before('deploy environment', async function () {
    this.timeout(25000);

    await hre.run(TASK_DEPLOY, {
      ...deploymentInfo,
      clear: true,
      noConfirm: true,
      quiet: true,
      debug: false,
    });
  });

  after('restore the snapshot', async function () {
    await restoreSnapshot(snapshotId, ethers.provider);
  });

  return { deploymentInfo };
};
