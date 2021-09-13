const hre = require('hardhat');
const { ethers } = hre;
const { getProxyAddress, getDeployment } = require('../../../../utils/deployments');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/rpc');

let snapshotId;
let proxyAddress;

function bootstrap() {
  before('deploy system only once if needed', async () => {
    if (!proxyAddress) {
      const deployment = getDeployment();

      if (!deployment) {
        await deploySystem();
      } else {
        proxyAddress = getProxyAddress();

        const proxyCode = await ethers.provider.getCode(proxyAddress);

        if (proxyCode === '0x') {
          await deploySystem();
        }
      }
    }
  });

  before('take a snapshot', async () => {
    snapshotId = await takeSnapshot(ethers.provider);
  });

  after('restore the snapshot', async () => {
    await restoreSnapshot(snapshotId, ethers.provider);
  });
}

async function deploySystem() {
  await hre.run('deploy', {
    network: hre.config.network,
    noConfirm: true,
    clear: true,
    quiet: true,
  });

  proxyAddress = getProxyAddress();
}

async function initializeSystem({ owner }) {
  await initializeOwner({ owner });
}

async function initializeOwner({ owner }) {
  let tx;

  const OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);

  tx = await OwnerModule.connect(owner).nominateOwner(owner.address);
  await tx.wait();

  tx = await OwnerModule.connect(owner).acceptOwnership();
  await tx.wait();
}

module.exports = {
  bootstrap,
  deploySystem,
  initializeSystem,
  initializeOwner,
};
