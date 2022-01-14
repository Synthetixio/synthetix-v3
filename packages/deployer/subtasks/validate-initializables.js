const { subtask } = require('hardhat/config');
const mapValues = require('just-map-values');
const logger = require('@synthetixio/core-js/utils/io/logger');
const ModuleInitializableASTValidator = require('../internal/initializable-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_INITIALIZABLES } = require('../task-names');

subtask(SUBTASK_VALIDATE_INITIALIZABLES).setAction(async (_, hre) => {
  logger.subtitle('Validating initializable contracts');

  const { deployment } = hre.deployer;

  const asts = mapValues(deployment.sources, (val) => val.ast);
  const validator = new ModuleInitializableASTValidator(asts);

  let errorsFound = [];
  errorsFound.push(...validator.findMissingInitializer());
  errorsFound.push(...validator.findMissingIsInitialized());

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    errorsFound.map((err) => logger.debug(JSON.stringify(err, null, 2)));

    throw new ContractValidationError(
      `Invalid initializable contracts: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Initializable contracts are valid');
});
