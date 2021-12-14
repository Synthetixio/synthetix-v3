const logger = require('@synthetixio/core-js/utils/io/prompter');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { subtask } = require('hardhat/config');
const { processTransaction } = require('../internal/process-transactions');
const { UPGRADE_ABI } = require('../internal/abis');
const { SUBTASK_UPGRADE_PROXY } = require('../task-names');

subtask(SUBTASK_UPGRADE_PROXY, 'Upgrades the main proxy if needed').setAction(async (_, hre) => {
  logger.subtitle('Upgrading main proxy');

  const routerName = 'Router';
  const proxyName = hre.config.deployer.proxyContract;

  const proxyAddress = _getDeployedAddress(proxyName, hre);
  let ProxyContract = await hre.ethers.getContractAt(
    UPGRADE_ABI,
    proxyAddress,
    hre.ethers.provider
  );

  const activeImplementationAddress = await ProxyContract.getImplementation();
  logger.debug(`Active implementation: ${activeImplementationAddress}`);

  const routerAddress = _getDeployedAddress(routerName, hre);
  logger.debug(`Target implementation: ${routerAddress}`);

  if (activeImplementationAddress !== routerAddress) {
    logger.notice(
      `Main Proxy upgrade needed - Proxy implementation ${activeImplementationAddress} is different from the latest deployer router`
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

function _getDeployedAddress(contractName, hre) {
  return hre.deployer.deployment.general.contracts[contractName].deployedAddress;
}
