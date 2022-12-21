/* eslint-env mocha */

const { restoreSnapshot, takeSnapshot } = require('@synthetixio/core-utils/utils/hardhat/rpc');
const { TASK_DEPLOY } = require('@synthetixio/hardhat-router/dist/task-names');
const hre = require('hardhat');

exports.bootstrap = function bootstrap(initializer = () => {}, customDeployOptions = {}) {
  let snapshotId;
  let result = null;

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async () => {
    const opts = {
      quiet: true,
      ...customDeployOptions,
    };

    result = await hre.run(TASK_DEPLOY, opts);
  });

  before('initialize system', async () => {
    if (!result) {
      throw new Error('Invalid deployment result');
    }

    await initializer(result);
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, hre.ethers.provider);
  });

  const proxyAddress = () => result.contracts.Proxy.deployedAddress;
  const routerAddress = () => result.contracts.Router.deployedAddress;

  return { proxyAddress, routerAddress, provider: () => hre.ethers.provider };
};
