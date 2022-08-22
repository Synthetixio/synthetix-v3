const { default: logger } = require('@synthetixio/core-js/dist/utils/io/logger');
const { default: prompter } = require('@synthetixio/core-js/dist/utils/io/prompter');
const { subtask } = require('hardhat/config');
const { processTransaction } = require('../internal/process-transactions');
const { UPGRADE_ABI } = require('../internal/abis');
const { SUBTASK_UPGRADE_PROXY } = require('../task-names');

subtask(SUBTASK_UPGRADE_PROXY, 'Upgrades the main proxy if needed').setAction(async (_, hre) => {
  logger.subtitle('Upgrading main proxy');

  const contracts = Object.values(hre.router.deployment.general.contracts);
  const routerData = contracts.find((data) => data.isRouter);
  const proxyData = contracts.find((data) => data.isProxy);

  const routerAddress = routerData.deployedAddress;
  const proxyAddress = proxyData.deployedAddress;

  let ProxyContract = await hre.ethers.getContractAt(
    UPGRADE_ABI,
    proxyAddress,
    hre.ethers.provider
  );

  const activeImplementationAddress = await ProxyContract.getImplementation();
  logger.debug(`Active implementation: ${activeImplementationAddress}`);

  logger.debug(`Target implementation: ${routerAddress}`);

  if (activeImplementationAddress !== routerAddress) {
    logger.notice(
      `Main Proxy upgrade needed - Proxy implementation ${activeImplementationAddress} is different from the latest hardhat-router`
    );

    await prompter.confirmAction('Upgrade system');
    logger.notice(`Upgrading main proxy to ${routerAddress}`);

    try {
      const [signer] = await hre.ethers.getSigners();

      ProxyContract = ProxyContract.connect(signer);

      const transaction = await ProxyContract.upgradeTo(routerAddress);
      await processTransaction({ transaction, hre, description: 'Proxy upgrade' });

      logger.success(`Main proxy upgraded to ${await ProxyContract.getImplementation()}`);
    } catch (err) {
      logger.warn(`Unable to upgrade main proxy - Reason: ${err}`);
    }
  } else {
    logger.checked('No need to upgrade the main proxy');
  }
});
