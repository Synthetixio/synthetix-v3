const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_PROXY, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(SUBTASK_DEPLOY_PROXY, 'Deploys the main proxy if needed').setAction(async (_, hre) => {
  logger.subtitle('Deploying main proxy');

  const routerName = 'Router';
  const proxyName = hre.config.deployer.proxyContract;

  await _deployProxy(proxyName, routerName, hre);

  _setProxyOnModules(proxyName, hre);
});

async function _deployProxy(proxyName, routerName, hre) {
  const routerAddress = hre.deployer.deployment.general.contracts[routerName].deployedAddress;

  await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractName: proxyName,
    constructorArgs: [routerAddress],
  });
}

function _setProxyOnModules(proxyName, hre) {
  const proxy = hre.deployer.deployment.general.contracts[proxyName];

  Object.values(hre.deployer.deployment.general.contracts).map((contract) => {
    if (contract.isModule) {
      contract.proxyAddress = proxy.deployedAddress;
    }
  });
}
