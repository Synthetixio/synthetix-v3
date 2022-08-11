const { default: logger } = require('@synthetixio/core-js/utils/io/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_DEPLOY_PROXY, SUBTASK_DEPLOY_CONTRACT } = require('../task-names');

subtask(SUBTASK_DEPLOY_PROXY, 'Deploys the main proxy if needed').setAction(async (_, hre) => {
  logger.subtitle('Deploying main proxy');

  const contracts = Object.values(hre.deployer.deployment.general.contracts);
  const routerData = contracts.find((data) => data.isRouter);
  const proxyData = contracts.find((data) => data.isProxy);

  await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractFullyQualifiedName: proxyData.contractFullyQualifiedName,
    constructorArgs: [routerData.deployedAddress],
  });

  _setProxyOnModules(proxyData.deployedAddress, hre);
});

function _setProxyOnModules(proxyAddress, hre) {
  for (const contractData of Object.values(hre.deployer.deployment.general.contracts)) {
    if (contractData.isModule) {
      contractData.proxyAddress = proxyAddress;
    }
  }
}
