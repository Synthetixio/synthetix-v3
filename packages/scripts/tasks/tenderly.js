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
    assertTenderly(hre);

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

task('tenderly:exec')
  .addPositionalParam('method', 'Method to execute on all councils')
  .addOptionalVariadicPositionalParam(
    'params',
    'Param to pass to the method as a JSON array string',
    []
  )
  .addOptionalParam('instance', 'Deployment instance name', 'official', types.alphanumeric)
  .setAction(async ({ method, params, instance }, hre) => {
    assertTenderly(hre);

    console.log();

    for (const council of COUNCILS) {
      const Proxy = await getPackageProxy(hre, council, instance);

      await asOwner(Proxy, async () => {
        const fnAbi = Proxy.interface.fragments.find((f) => f.name === method);

        if (!fnAbi) throw new Error(`Method ${method} not found on ${Proxy.address}`);
        if (fnAbi.type !== 'function') throw new Error(`Method ${method} is not a function`);

        const isWriteCall = fnAbi.stateMutability !== 'view' && fnAbi.stateMutability !== 'pure';

        console.log(`${council}: Proxy.${method}(${params.map((v) => `"${v}"`).join(', ')})`);

        if (isWriteCall) {
          const tx = await Proxy[method](...params);
          await tx.wait();
          console.log('  tx hash:', tx.hash);
        } else {
          const res = await Proxy[method](...params);
          console.log('  ', res);
        }

        console.log();
      });
    }
  });

/**
 * Set temporarily the current signer as owner of the proxy and execute the given function.
 * After the function is executed, the original owner is restored.
 * @param {Proxy} Proxy
 * @param {() => {}} fn
 */
async function asOwner(Proxy, fn) {
  const signer = await hre.ethers.provider.getSigner();
  const signerAddress = (await signer.getAddress()).toLowerCase().slice(2);

  // Storage slot location of the value for OwnableStorage.owner
  const location = getStorageSlot('io.synthetix.ownable');
  const offset = 2;

  const originalValue = await hre.ethers.provider.getStorageAt(Proxy.address, location);

  // Create a new storage value with the signer address as the owner
  const newValue = [
    originalValue.slice(0, originalValue.length - signerAddress.length - offset),
    signerAddress,
    originalValue.slice(-offset),
  ].join('');

  try {
    // Set it before executing the function
    await hre.ethers.provider.send('tenderly_setStorageAt', [Proxy.address, location, newValue]);
    await fn();
  } finally {
    // Restore the original owner always
    await hre.ethers.provider.send('tenderly_setStorageAt', [
      Proxy.address,
      location,
      originalValue,
    ]);
  }
}

function assertTenderly(hre) {
  if (!hre.network.config.url.startsWith('https://rpc.tenderly.co/fork')) {
    throw new Error('This task can only be run on Tenderly forks');
  }
}
