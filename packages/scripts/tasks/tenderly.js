const path = require('path');
const fs = require('fs/promises');
const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const types = require('@synthetixio/core-js/utils/hardhat/argument-types');
const { getPackageDeployment, getPackageProxy } = require('../internal/packages');
const { COUNCILS } = require('../internal/constants');
const { getStorageSlot } = require('../internal/storage-slot');

task('tenderly:deployments:copy', 'Copy deployments forks to fork folder')
  .addOptionalParam('from', 'Deployment reference', 'optimistic-mainnet')
  .addOptionalParam('target', 'Deployment reference', 'optimistic-mainnet-fork')
  .setAction(async ({ from, target }) => {
    for (const council of COUNCILS) {
      const deploymentsFolder = path.join(__dirname, '..', '..', council, 'deployments');
      const fromFolder = path.join(deploymentsFolder, from);
      const targetFolder = path.join(deploymentsFolder, target);

      console.log('Copying deployments of council:', council);
      console.log(' - from:', fromFolder);
      console.log(' - target:', targetFolder);
      console.log('');

      await fs.cp(fromFolder, targetFolder, { force: true, recursive: true });
    }
  });

task('tenderly:deployments:delete', 'Copy deployments forks to fork folder')
  .addOptionalParam('target', 'Deployment reference', 'optimistic-mainnet-fork')
  .setAction(async ({ target }) => {
    for (const council of COUNCILS) {
      const deploymentsFolder = path.join(__dirname, '..', '..', council, 'deployments');
      const targetFolder = path.join(deploymentsFolder, target);

      console.log('Deleting deployments of council:', council);
      console.log(' - target:', targetFolder);
      console.log('');

      await fs.rm(targetFolder, { recursive: true });
    }
  });

task('tenderly:upgrade-proxies')
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .setAction(async ({ instance }, hre) => {
    if (!hre.network.config.url.startsWith('https://rpc.tenderly.co/fork')) {
      throw new Error('This task can only be run on Tenderly forks');
    }

    for (const council of COUNCILS) {
      const deployment = getPackageDeployment(hre, council, instance);
      const Proxy = await getPackageProxy(hre, council, instance);

      const newRouter = Object.values(deployment.contracts).find((c) => c.isRouter).deployedAddress;
      const currentRouter = await Proxy.getImplementation();

      if (newRouter === currentRouter) {
        logger.success(`Proxy for ${council} already upgraded`);
        continue;
      }

      await asOwner(Proxy, async () => {
        const tx = await Proxy.upgradeTo(newRouter);
        await tx.wait();
      });

      logger.success(`Upgraded "${council}" from ${currentRouter} to ${newRouter}`);
    }
  });

async function asOwner(Proxy, fn) {
  const location = getStorageSlot('io.synthetix.ownable');
  const offset = 2;
  const signer = await hre.ethers.provider.getSigner();
  const signerAddress = (await signer.getAddress()).toLowerCase().slice(2);

  const originalValue = await hre.ethers.provider.getStorageAt(Proxy.address, location);
  const newValue = [
    originalValue.slice(0, originalValue.length - signerAddress.length - offset),
    signerAddress,
    originalValue.slice(-offset),
  ].join('');

  try {
    await hre.ethers.provider.send('tenderly_setStorageAt', [Proxy.address, location, newValue]);
    await fn();
  } finally {
    await hre.ethers.provider.send('tenderly_setStorageAt', [
      Proxy.address,
      location,
      originalValue,
    ]);
  }
}
