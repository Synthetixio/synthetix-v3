const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { readDeploymentFile } = require('../utils/deploymentFile');
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

let _hre;

/*
 * Checks if the main proxy needs to be deployed,
 * and upgrades it if needed.
 * */
subtask(SUBTASK_UPGRADE_PROXY).setAction(async (_, hre) => {
  _hre = hre;

  logger.subtitle('Upgrading main proxy');

  const data = readDeploymentFile({ hre });

  const implementationAddress = data[`Router_${hre.network.name}`].deployedAddress;
  logger.info(`Target implementation: ${implementationAddress}`);

  await _deployProxy({ implementationAddress });
  await _upgradeProxy({ implementationAddress });
});

async function _deployProxy({ implementationAddress }) {
  await _hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contractNames: [_hre.config.deployer.proxyName],
    force: false,
    constructorArgs: [[implementationAddress]],
  });
}

async function _upgradeProxy({ implementationAddress }) {
  const data = readDeploymentFile({ hre: _hre });
  const proxyAddress = data[_hre.config.deployer.proxyName].deployedAddress;

  const upgradeable = await _hre.ethers.getContractAt(UPGRADE_ABI, proxyAddress);
  const activeImplementationAddress = await upgradeable.getImplementation();
  logger.info(`Active implementation: ${activeImplementationAddress}`);

  if (activeImplementationAddress !== implementationAddress) {
    logger.notice(
      `Proxy upgrade needed - Main proxy implementation ${activeImplementationAddress} is different from the target implementation`
    );

    await prompter.confirmAction('Upgrade system');

    logger.notice(`Upgrading main proxy to ${implementationAddress}`);

    const tx = await upgradeable.upgradeTo(implementationAddress);
    await tx.wait();

    logger.success(`Main proxy upgraded to ${await upgradeable.getImplementation()}`);
  } else {
    logger.checked('No need to upgrade the main proxy');
  }
}
