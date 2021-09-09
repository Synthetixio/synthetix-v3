const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const path = require('path');
const relativePath = require('@synthetixio/core-js//utils/relative-path');
const { subtask } = require('hardhat/config');
const { processTransaction, processReceipt } = require('../internal/process-transactions');
const { getRouterName } = require('../utils/router');
const { getProxyPath } = require('../utils/deployments');
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
).setAction(async ({ instance }, hre) => {
  logger.subtitle('Upgrading main proxy');

  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    getRouterName({ network: hre.network.name, instance })
  );

  const proxyPath = getProxyPath(hre.config);
  const routerAddress = _getDeployedAddress(routerPath, hre);

  logger.info(`Target implementation: ${routerAddress}`);

  const wasProxyDeployed = await _deployProxy({
    proxyPath,
    routerAddress,
    hre,
  });

  if (!wasProxyDeployed) {
    const proxyAddress = _getDeployedAddress(proxyPath, hre);
    await _upgradeProxy({ proxyAddress, routerAddress, hre });
  }
});

function _getDeployedAddress(contractPath, hre) {
  return hre.deployer.data.contracts[contractPath].deployedAddress;
}

async function _deployProxy({ proxyPath, routerAddress, hre }) {
  let proxyData = hre.deployer.data.contracts[proxyPath];

  if (!proxyData) {
    hre.deployer.data.contracts[proxyPath] = {
      deployedAddress: '',
      deployTransaction: '',
      bytecodeHash: '',
    };
    proxyData = hre.deployer.data.contracts[proxyPath];
  }

  return await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractPath: proxyPath,
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
