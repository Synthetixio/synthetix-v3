const { subtask } = require('hardhat/config');
const { getFullyQualifiedName } = require('hardhat/utils/contract-names');
const logger = require('@synthetixio/core-js/utils/io/logger');
const { initContractData } = require('../internal/process-contracts');
const RouterSourceValidator = require('../internal/router-source-validator');
const RouterASTValidator = require('../internal/router-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { getModulesSelectors } = require('../internal/contract-helper');
const { getRouterSource } = require('../internal/router-helper');
const { SUBTASK_VALIDATE_ROUTER } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async () => {
  logger.subtitle('Validating router');

  const routerName = 'Router';
  const { sourceName } = await hre.artifacts.readArtifact(routerName);
  const routerFullyQualifiedName = getFullyQualifiedName(sourceName, routerName);

  await initContractData(routerFullyQualifiedName, { isRouter: true });

  const sourceErrorsFound = await _runSourceValidations();
  const astErrorsFound = await _runASTValidations(routerFullyQualifiedName);

  if (sourceErrorsFound.length > 0 || astErrorsFound.length > 0) {
    throw new ContractValidationError(
      `Router is not valid: ${JSON.stringify(sourceErrorsFound)}, ${JSON.stringify(astErrorsFound)}`
    );
  }

  logger.checked('Router is valid');
});

async function _runSourceValidations() {
  const errorsFound = [];

  const validator = new RouterSourceValidator({
    getModulesSelectors,
    getRouterSource,
  });

  logger.debug('Validating Router source code');

  errorsFound.push(...(await validator.findMissingModuleSelectors()));
  errorsFound.push(...(await validator.findRepeatedModuleSelectors()));

  for (const error of errorsFound) {
    logger.error(error.msg);
  }

  return errorsFound;
}

async function _runASTValidations(routerFullyQualifiedName) {
  const errorsFound = [];

  const astNodes = Object.values(hre.deployer.deployment.sources).map((val) => val.ast);
  const validator = new RouterASTValidator(routerFullyQualifiedName, astNodes);

  logger.debug('Validating Router compiled code');

  errorsFound.push(...(await validator.findMissingModuleSelectors()));
  errorsFound.push(...(await validator.findUnreachableModuleSelectors()));
  errorsFound.push(...(await validator.findDuplicateModuleSelectors()));

  for (const error of errorsFound) {
    logger.error(error.msg);
  }

  return errorsFound;
}
