const path = require('path');
const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');
const { getAllSelectors, findDuplicateSelectors } = require('../internal/contract-helper');
const { SUBTASK_VALIDATE_MODULES } = require('../task-names');

subtask(SUBTASK_VALIDATE_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Validating modules');

  const modules = filterValues(hre.deployer.deployment.contracts, (c) => c.isModule);
  const moduleNames = Object.keys(modules);
  const selectors = await getAllSelectors(moduleNames);
  const duplicates = findDuplicateSelectors(selectors);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.fn} found in modules ${d.contracts} - ${d.selector}\n`
    );

    logger.error(`Duplicate selectors found!\n${details.join('')}`);
    logger.info(`Deleting ${hre.deployer.deployment.file}`);
    rimraf.sync(path.resolve(hre.config.paths.root, hre.deployer.deployment.file));
    process.exit(0);
  }
});
