const { TASK_DEPLOY } = require('@synthetixio/deployer/task-names');
const { getProxyAddress, getRouterAddress } = require('@synthetixio/deployer/utils/deployments');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/hardhat/rpc');
const { defaultDeploymentInfo } = require('./deployments');

function bootstrap(initializer = () => {}, customDeployOptions = {}) {
  let snapshotId;

  const deploymentInfo = {
    ...defaultDeploymentInfo,
    proxyContract: hre.config.deployer.proxyContract,
    network: hre.config.defaultNetwork,
    instance: 'test',
  };

  before('take a snapshot', async function () {
    snapshotId = await takeSnapshot(hre.ethers.provider);
  });

  before('deploy system', async function () {
    this.timeout(100000);
    await deploySystem(deploymentInfo, { clear: true, ...customDeployOptions });
  });

  before('initialize system', async function () {
    await initializer(deploymentInfo);
  });

  after('restore the snapshot', async function () {
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
