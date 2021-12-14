const logger = require('@synthetixio/core-js/utils/io/logger');
const { subtask } = require('hardhat/config');

const { SUBTASK_DEPLOY_CONTRACT, SUBTASK_DEPLOY_ROUTER } = require('../task-names');

subtask(SUBTASK_DEPLOY_ROUTER).setAction(async (_, hre) => {
  logger.subtitle('Deploying router');

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACT, {
    contractName: 'Router',
  });

  if (!deployedSomething) {
    logger.checked('The router does not need to be deployed');
  }
});
