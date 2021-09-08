const { subtask } = require('hardhat/config');

const logger = require('../utils/logger');
const {
  SUBTASK_CLEAR_DEPLOYMENT,
  SUBTASK_DEPLOY_CONTRACTS,
  SUBTASK_DEPLOY_MODULES,
} = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Deploying modules');

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: hre.deployer.data.contracts.modules,
  });

  if (!deployedSomething) {
    logger.info('No modules need to be deployed...');
    await hre.run(SUBTASK_CLEAR_DEPLOYMENT);
  }
});
