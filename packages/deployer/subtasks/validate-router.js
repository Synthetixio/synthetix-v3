const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getSourcesAST } = require('../internal/ast/ast-sources');
const {
  findDuplicateSelectorsInAST,
  findMissingSelectorsInAST,
  findUnreachableSelectorsInAST,
} = require('../internal/ast/router-validator');
const {
  findMissingSelectorsInSource,
  findRepeatedSelectorsInSource,
  findWrongSelectorsInSource,
} = require('../internal/router-source-validator');

const { SUBTASK_VALIDATE_ROUTER, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async (_, hre) => {
  logger.subtitle('Validating router');

  const { contracts } = await getSourcesAST(hre);

  let errorsFound = [];
  // Source Code checking
  errorsFound.push(...(await findMissingSelectorsInSource()));
  errorsFound.push(...(await findRepeatedSelectorsInSource()));
  errorsFound.push(...(await findWrongSelectorsInSource()));

  // AST checking
  errorsFound.push(...(await findMissingSelectorsInAST(contracts)));
  errorsFound.push(...(await findUnreachableSelectorsInAST(contracts)));
  errorsFound.push(...(await findDuplicateSelectorsInAST(contracts)));

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });
    logger.error('Router is not valid');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }
  logger.checked('Router is valid');
});
