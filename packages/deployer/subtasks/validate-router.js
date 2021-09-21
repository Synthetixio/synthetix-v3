const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getSourcesAST } = require('../internal/ast/ast-sources');
const {
  findDuplicateSelectorsCompiled,
  findMissingSelectors,
  findMissingSelectorsCompiled,
  findUnreachableSelectorsCompiled,
} = require('../internal/ast/router-validator');

const { SUBTASK_VALIDATE_ROUTER, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_VALIDATE_ROUTER,
  'Runs a series of validations against a generated router source.'
).setAction(async (_, hre) => {
  logger.subtitle('Validating router');

  const { contracts } = await getSourcesAST(hre);

  let errorsFound;
  errorsFound = (await findMissingSelectors()) || errorsFound;
  errorsFound = (await findMissingSelectorsCompiled(contracts)) || errorsFound;
  errorsFound = (await findUnreachableSelectorsCompiled(contracts)) || errorsFound;
  errorsFound = (await findDuplicateSelectorsCompiled(contracts)) || errorsFound;

  if (errorsFound) {
    logger.error('Router is not valid');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }
  logger.checked('Router is valid');
});
