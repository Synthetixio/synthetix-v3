const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_PROXY, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(SUBTASK_DEPLOY_PROXY, 'Deploys the main proxy if needed').setAction(async (_, hre) => {
  logger.subtitle('Deploying main proxy');

  const routerName = 'Router';
  const proxyName = hre.config.deployer.proxyContract;

  const routerAddress = hre.deployer.deployment.general.contracts[routerName].deployedAddress;

  await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractName: proxyName,
    constructorArgs: [routerAddress],
  });
});
