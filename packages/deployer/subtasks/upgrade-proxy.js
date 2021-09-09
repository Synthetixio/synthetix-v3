const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const path = require('path');
const relativePath = require('@synthetixio/core-js//utils/relative-path');
const { subtask } = require('hardhat/config');
const { processTransaction, processReceipt } = require('../internal/process-transactions');
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

subtask(
  SUBTASK_UPGRADE_PROXY,
  'Checks if the main proxy needs to be deployed, and upgrades it if needed.'
).setAction(async (_, hre) => {
  logger.subtitle('Upgrading main proxy');

  const routerName = 'Router';
  const proxyName = 'Proxy';

  const routerAddress = _getDeployedAddress(routerName, hre);

  logger.info(`Target implementation: ${routerAddress}`);

  const proxyPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    `${proxyName}.sol`
  );

  const wasProxyDeployed = await _deployProxy({
    proxyName,
    proxyPath,
    routerAddress,
    hre,
  });

  if (!wasProxyDeployed) {
    const proxyAddress = _getDeployedAddress(proxyName, hre);
    await _upgradeProxy({ proxyAddress, routerAddress, hre });
  }
});

function _getDeployedAddress(contractName, hre) {
  return hre.deployer.data.contracts[contractName].deployedAddress;
}

async function _deployProxy({ proxyName, proxyPath, routerAddress, hre }) {
  let proxyData = hre.deployer.data.contracts[proxyName];

  if (!proxyData) {
    hre.deployer.data.contracts[proxyName] = {
      source: proxyPath,
      deployedAddress: '',
      deployTransaction: '',
      bytecodeHash: '',
    };
    proxyData = hre.deployer.data.contracts[proxyName];
  }

  return await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractName: proxyName,
    contractData: proxyData,
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
