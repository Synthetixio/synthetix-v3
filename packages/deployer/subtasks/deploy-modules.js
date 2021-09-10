const path = require('path');
const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');

const logger = require('@synthetixio/core-js/utils/logger');
const filterObject = require('../internal/filter-object');
const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_MODULES } = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Deploying modules');

  const modules = filterObject(hre.deployer.data.contracts, (c) => c.isModule);

  const deployedSomething = await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: modules,
  });

  if (!deployedSomething) {
    logger.info('No modules need to be deployed, clearing generated files and exiting...');
    logger.info(`Deleting ${hre.deployer.data.file}`);
    rimraf.sync(path.resolve(hre.config.paths.root, hre.deployer.data.file));
    process.exit(0);
  }
});
