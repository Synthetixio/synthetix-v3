const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/utils/io/logger');
const { getAllSelectors, findDuplicateSelectors } = require('../internal/contract-helper');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_MODULES } = require('../task-names');

subtask(SUBTASK_VALIDATE_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Validating modules');

  const modulesFullyQualifiedNames = Object.entries(hre.router.deployment.general.contracts)
    .filter(([, attrs]) => attrs.isModule)
    .map(([name]) => name);

  const selectors = await getAllSelectors(modulesFullyQualifiedNames, hre);
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
