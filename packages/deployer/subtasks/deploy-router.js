const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  const routerData = Object.values(hre.deployer.deployment.general.contracts).find(
    (data) => data.isRouter
  );

  const { contractFullyQualifiedName } = routerData;

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractFullyQualifiedName,
  });

  if (!deployedSomething) {
    logger.checked('The router does not need to be deployed');
  }
});
