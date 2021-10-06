const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const mapValues = require('just-map-values');
const { initContractData } = require('../internal/process-contracts');
const RouterSourceValidator = require('../internal/router-source-validator');
const RouterASTValidator = require('../internal/router-ast-validator');
const { SUBTASK_VALIDATE_ROUTER, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async (_, hre) => {
  logger.subtitle('Validating router');

  await initContractData('Router');

  const sourceErrorsFound = await _runSourceValidations();
  const astErrorsFound = await _runASTValidations();

  if (sourceErrorsFound.length > 0 || astErrorsFound.length > 0) {
    logger.error('Router is not valid');

    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Router is valid');
});

async function _runSourceValidations() {
  const errorsFound = [];

  const validator = new RouterSourceValidator();

  logger.debug('Validating Router source code');
  errorsFound.push(...(await validator.findMissingModuleSelectors()));
  errorsFound.push(...(await validator.findRepeatedModuleSelectors()));
  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });
  }

  return errorsFound;
}

async function _runASTValidations() {
  const errorsFound = [];

  const asts = mapValues(hre.deployer.deployment.sources, (val) => val.ast);
  const validator = new RouterASTValidator(asts);

  logger.debug('Validating Router compiled code');
  errorsFound.push(...(await validator.findMissingModuleSelectors()));
  errorsFound.push(...(await validator.findUnreachableModuleSelectors()));
  errorsFound.push(...(await validator.findDuplicateModuleSelectors()));
  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });
  }

  return errorsFound;
}
