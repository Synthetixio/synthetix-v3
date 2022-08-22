const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/dist/utils/io/logger');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  const routerData = Object.values(hre.router.deployment.general.contracts).find(
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
