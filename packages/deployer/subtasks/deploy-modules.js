const { subtask } = require('hardhat/config');

const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');
const {
  SUBTASK_DEPLOY_CONTRACTS,
  SUBTASK_DEPLOY_MODULES,
  SUBTASK_CANCEL_DEPLOYMENT,
} = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Deploying modules');

  const modules = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: modules,
  });

  if (!deployedSomething) {
    logger.info('No modules need to be deployed, cancelling execution...');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }
});
