const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
// const { processTransaction, processReceipt } = require('../utils/transactions');
const { SUBTASK_UPGRADE_PROXY, SUBTASK_DEPLOY_CONTRACTS } = require('../task-names');

const UPGRADE_ABI = [
  {
    inputs: [],
    name: 'getImplementation',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newImplementation',
        type: 'address',
      },
    ],
    name: 'upgradeTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

/*
 * Checks if the main proxy needs to be deployed,
 * and upgrades it if needed.
 * */
subtask(SUBTASK_UPGRADE_PROXY).setAction(async (_, hre) => {
  logger.subtitle('Upgrading main proxy');

  const routerData = hre.deployer.data.contracts[hre.deployer.paths.routerPath];
  const { deployedAddress: implementationAddress } = routerData;

  logger.info(`Target implementation: ${implementationAddress}`);

  const wasProxyDeployed = await _deployProxy({ implementationAddress });

  // TODO: For some very strange reason, hre within _upgradeProxy is undefined.
  // This only seems to happen if _deployProxy was called first!
  // Hardhat seems to loose hre from the global context as soon as
  // a third depth level of subtasks is reached.
  // The workaround is to pass hre which is still maintained in the scope of
  // the subtask.
  if (!wasProxyDeployed) {
    await _upgradeProxy({ implementationAddress, hre });
  }
});

async function _deployProxy({ implementationAddress }) {
  const deployed = await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contractNames: [hre.config.deployer.proxyName],
    constructorArgs: [[implementationAddress]],
  });

  return deployed.length > 0;
}

async function _upgradeProxy({ implementationAddress, hre }) {
  const data = hre.deployer.data.contracts;
  const proxyAddress = data[hre.config.deployer.proxyName].deployedAddress;

  const upgradeable = await hre.ethers.getContractAt(UPGRADE_ABI, proxyAddress);
  const activeImplementationAddress = await upgradeable.getImplementation();
  logger.info(`Active implementation: ${activeImplementationAddress}`);

  if (activeImplementationAddress !== implementationAddress) {
    logger.notice(
      `Proxy upgrade needed - Main proxy implementation ${activeImplementationAddress} is different from the target implementation`
    );

    await prompter.confirmAction('Upgrade system');

    logger.notice(`Upgrading main proxy to ${implementationAddress}`);

    const tx = await upgradeable.upgradeTo(implementationAddress);
    processTransaction({ transaction: tx, hre });

    const receipt = await tx.wait();
    processReceipt({ receipt, hre });

    logger.success(`Main proxy upgraded to ${await upgradeable.getImplementation()}`);
  } else {
    logger.checked('No need to upgrade the main proxy');
  }
}
