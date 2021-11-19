const {
  getProxyAddress,
  getRouterAddress,
} = require('@synthetixio/deployer/utils/deployments');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');

function bootstrap(initializer = () => {}) {
  let snapshotId;

  const deploymentInfo = {
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async () => {
    await deploySystem(deploymentInfo, { clear: true });
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

async function deploySystem(deploymentInfo, customOptions = {}) {
  await hre.run(TASK_DEPLOY, {
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
