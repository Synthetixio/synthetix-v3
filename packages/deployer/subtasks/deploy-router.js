const path = require('path');
const { subtask } = require('hardhat/config');
const { getFullyQualifiedName } = require('hardhat/utils/contract-names');
const relativePath = require('@synthetixio/core-js/utils/misc/relative-path');
const logger = require('@synthetixio/core-js/utils/io/logger');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  const routerName = 'Router';
  const routerPath = path.join(hre.config.paths.sources, `${routerName}.sol`);
  const relativeRouterPath = relativePath(routerPath, hre.config.paths.root);
  const routerFullyQualifiedName = getFullyQualifiedName(relativeRouterPath, routerName);

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractFullyQualifiedName: routerFullyQualifiedName,
  });

  if (!deployedSomething) {
    logger.checked('The router does not need to be deployed');
  }
});
