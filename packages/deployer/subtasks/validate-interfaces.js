const { subtask } = require('hardhat/config');
const mapValues = require('just-map-values');
const logger = require('@synthetixio/core-js/utils/io/logger');
const InterfaceCoverageASTValidator = require('../internal/interface-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_INTERFACES } = require('../task-names');

subtask(SUBTASK_VALIDATE_INTERFACES).setAction(async (_, hre) => {
  logger.subtitle('Validating all visible functions are defined in interfaces');

  const { deployment } = hre.deployer;

  const asts = mapValues(deployment.sources, (val) => val.ast);
  const validator = new InterfaceCoverageASTValidator(asts);

  let errorsFound = [];
  errorsFound.push(...validator.findFunctionsNotDefinedInInterfaces());

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    errorsFound.map((err) => logger.debug(JSON.stringify(err, null, 2)));

    throw new ContractValidationError(
      `Missing interfaces for contracts: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Visible functions are defined in interfaces');
});
