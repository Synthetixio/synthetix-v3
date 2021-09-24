const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getSourcesAST } = require('../internal/ast/ast-sources');
const {
  findDuplicateSelectorsInAST,
  findMissingSelectorsInAST,
  findUnreachableSelectorsInAST,
} = require('../internal/ast/router-ast-validator');
const {
  findMissingSelectorsInSource,
  findRepeatedSelectorsInSource,
  findWrongSelectorsInSource,
} = require('../internal/router-source-validator');
const filterValues = require('filter-values');

const { SUBTASK_VALIDATE_ROUTER, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async (_, hre) => {
  logger.subtitle('Validating router');

  const { contracts } = await getSourcesAST(hre);
  const modules = filterValues(hre.deployer.deployment.general.contracts, (c) => c.isModule);

  let sourceErrorsFound = [];
  let astErrorsFound = [];
  // Source Code checking
  logger.debug('Validating Router source code');
  sourceErrorsFound.push(...(await findMissingSelectorsInSource()));
  sourceErrorsFound.push(...(await findRepeatedSelectorsInSource()));
  sourceErrorsFound.push(...(await findWrongSelectorsInSource()));
  if (sourceErrorsFound.length > 0) {
    sourceErrorsFound.forEach((error) => {
      logger.error(error.msg);
    });
  }

  // AST checking
  logger.debug('Validating Router compiled code');
  astErrorsFound.push(...(await findMissingSelectorsInAST(contracts)));
  astErrorsFound.push(...(await findUnreachableSelectorsInAST(contracts, modules)));
  astErrorsFound.push(...(await findDuplicateSelectorsInAST(contracts)));
  if (astErrorsFound.length > 0) {
    astErrorsFound.forEach((error) => {
      logger.error(error.msg);
    });
  }

  if (sourceErrorsFound.length > 0 || astErrorsFound.length > 0) {
    logger.error('Router is not valid');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Router is valid');
});
