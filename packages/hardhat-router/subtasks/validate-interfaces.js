const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/dist/utils/io/logger');
const InterfaceCoverageASTValidator = require('../internal/interface-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_INTERFACES } = require('../task-names');

subtask(SUBTASK_VALIDATE_INTERFACES).setAction(async (_, hre) => {
  logger.subtitle('Validating all visible functions are defined in interfaces');

  const moduleFullyQualifiedNames = Object.values(hre.router.deployment.general.contracts)
    .filter(({ isModule }) => isModule)
    .map((c) => c.contractFullyQualifiedName);
  const astNodes = Object.values(hre.router.deployment.sources).map((val) => val.ast);
  const validator = new InterfaceCoverageASTValidator(
    moduleFullyQualifiedNames,
    astNodes,
    hre.config.router.routerFunctionFilter
  );

  const errorsFound = validator.findFunctionsNotDefinedInInterfaces();

  if (errorsFound.length > 0) {
    for (const error of errorsFound) {
      logger.error(error.msg);
      logger.debug(JSON.stringify(error, null, 2));
    }

    throw new ContractValidationError(
      `Missing interfaces for contracts: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Visible functions are defined in interfaces');
});
