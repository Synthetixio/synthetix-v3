const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const SatellitesValidator = require('../internal/satellites-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_SATELLITES } = require('../task-names');

subtask(SUBTASK_VALIDATE_SATELLITES).setAction(async (_, hre) => {
  logger.subtitle('Validating satellite factory contracts');

  const moduleFullyQualifiedNames = Object.values(hre.deployer.deployment.general.contracts)
    .filter(({ isModule }) => isModule)
    .map((c) => c.contractFullyQualifiedName);
  const astNodes = Object.values(hre.deployer.deployment.sources).map((val) => val.ast);
  const validator = new SatellitesValidator(moduleFullyQualifiedNames, astNodes);

  const errorsFound = [];

  errorsFound.push(...validator.validateSatelliteGetters());

  if (errorsFound.length > 0) {
    for (const error of errorsFound) {
      logger.error(error.msg);
      logger.debug(JSON.stringify(error, null, 2));
    }

    throw new ContractValidationError(
      `Invalid satellite factory implementation on: ${errorsFound
        .map((error) => error.contractName)
        .join(', ')}`
    );
  }

  logger.checked('SatelliteFactory contracts are valid');
});
