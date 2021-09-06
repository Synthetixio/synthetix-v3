const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { processTransaction, processReceipt } = require('../utils/transactions');
const { SUBTASK_UPGRADE_PROXY, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

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

  const routerAddress = _getDeployedAddress(hre.deployer.paths.routerPath, hre);

  logger.info(`Target implementation: ${routerAddress}`);

  const wasProxyDeployed = await _deployProxy(routerAddress, hre);

  if (!wasProxyDeployed) {
    const proxyAddress = _getDeployedAddress(hre.deployer.paths.proxyPath, hre);
    await _upgradeProxy({ proxyAddress, routerAddress, hre });
  }
});

function _getDeployedAddress(contractPath, hre) {
  return hre.deployer.data.contracts[contractPath].deployedAddress;
}

async function _deployProxy(routerAddress, hre) {
  const contractPath = hre.deployer.paths.proxyPath;
  let contractData = hre.deployer.data.contracts[contractPath];

  if (!contractData) {
    hre.deployer.data.contracts[contractPath] = {
      deployedAddress: '',
      deployTransaction: '',
      bytecodeHash: '',
    };
    contractData = hre.deployer.data.contracts[contractPath];
  }

  return await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractPath,
    contractData,
    constructorArgs: [routerAddress],
  });
}

async function _upgradeProxy({ proxyAddress, routerAddress, hre }) {
  const upgradeable = await hre.ethers.getContractAt(UPGRADE_ABI, proxyAddress);
  const activeImplementationAddress = await upgradeable.getImplementation();
  logger.info(`Active implementation: ${activeImplementationAddress}`);

  if (activeImplementationAddress !== routerAddress) {
    logger.notice(
      `Proxy upgrade needed - Main proxy implementation ${activeImplementationAddress} is different from the target implementation`
    );

    await prompter.confirmAction('Upgrade system');

    logger.notice(`Upgrading main proxy to ${routerAddress}`);

    const transaction = await upgradeable.upgradeTo(routerAddress);

    processTransaction(transaction, hre);
    const receipt = await transaction.wait();
    processReceipt(receipt, hre);

    logger.success(`Main proxy upgraded to ${await upgradeable.getImplementation()}`);
  } else {
    logger.checked('No need to upgrade the main proxy');
  }
}
