const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const filterValues = require('filter-values');
const { getAllSelectors, findDuplicateSelectors } = require('../internal/contract-helper');
const { SUBTASK_VALIDATE_MODULES, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_VALIDATE_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Validating modules');

  const modules = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);
  const moduleNames = Object.keys(modules);
  const selectors = await getAllSelectors(moduleNames);
  const duplicates = findDuplicateSelectors(selectors);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.fn} found in modules ${d.contracts} - ${d.selector}\n`
    );

    logger.error(`Duplicate selectors found!\n${details.join('')}`);
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Modules are valid');
});
