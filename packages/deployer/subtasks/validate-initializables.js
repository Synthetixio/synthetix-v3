const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const ModuleInitializableASTValidator = require('../internal/initializable-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_INITIALIZABLES } = require('../task-names');

subtask(SUBTASK_VALIDATE_INITIALIZABLES).setAction(async (_, hre) => {
  logger.subtitle('Validating initializable contracts');

  const { deployment } = hre.deployer;

  const asts = Object.values(deployment.sources).map((val) => val.ast);
  const validator = new ModuleInitializableASTValidator(asts);

  let errorsFound = [];
  errorsFound.push(...validator.findMissingInitializer());
  errorsFound.push(...validator.findMissingIsInitialized());

  if (errorsFound.length > 0) {
    for (const error of errorsFound) {
      logger.error(error.msg);
      logger.debug(JSON.stringify(error, null, 2));
    }

    throw new ContractValidationError(
      `Invalid initializable contracts: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Initializable contracts are valid');
});
