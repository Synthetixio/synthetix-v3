const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const filterValues = require('filter-values');
const { getAllSelectors, findDuplicateSelectors } = require('../internal/contract-helper');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_MODULES } = require('../task-names');

subtask(SUBTASK_VALIDATE_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Validating modules');

  const modules = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);
  const moduleNames = Object.keys(modules);
  const selectors = await getAllSelectors(moduleNames);
  const duplicates = findDuplicateSelectors(selectors);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.fn} found in modules ${d.contracts} - ${d.selector}`
    );

    logger.error(`Duplicate selectors found!\n${details.join('\n')}`);

    throw new ContractValidationError('Found duplicate selectors on modules');
  }

  logger.checked('Modules are valid');
});
