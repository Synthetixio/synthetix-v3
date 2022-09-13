const { TASK_DEPLOY } = require('@synthetixio/hardhat-router/task-names');
const {
  getProxyAddress,
  getRouterAddress,
} = require('@synthetixio/hardhat-router/utils/deployments');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-utils/utils/hardhat/rpc');

function bootstrap(initializer = () => {}, customDeployOptions = {}) {
  let snapshotId;

  const deploymentInfo = {
    network: 'hardhat',
    instance: customDeployOptions.instance || 'test',
  };

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async () => {
    await deploySystem(deploymentInfo, { clear: true, ...customDeployOptions });
  });

  before('initialize system', async () => {
    await initializer(deploymentInfo);
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, hre.ethers.provider);
  });

  const proxyAddress = () => getProxyAddress(deploymentInfo);
  const routerAddress = () => getRouterAddress(deploymentInfo);

  return { deploymentInfo, proxyAddress, routerAddress };
}

async function deploySystem(deploymentInfo, customOptions = {}, _hre = hre) {
  await _hre.run(TASK_DEPLOY, {
    ...deploymentInfo,
    noConfirm: true,
    quiet: true,
    ...customOptions,
  });
}

module.exports = {
  bootstrap,
  deploySystem,
};
