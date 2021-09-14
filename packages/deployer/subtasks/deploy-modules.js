const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');

const logger = require('@synthetixio/core-js/utils/logger');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const filterValues = require('filter-values');
const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_MODULES } = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Deploying modules');

  const modules = filterValues(hre.deployer.deployment.data.contracts, (c) => c.isModule);

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: modules,
  });

  if (!deployedSomething) {
    logger.info('No modules need to be deployed, clearing generated files and exiting...');
    logger.info(`Deleting ${relativePath(hre.deployer.deployment.file)}`);
    rimraf.sync(hre.deployer.deployment.file);
    process.exit(0);
  }
});
