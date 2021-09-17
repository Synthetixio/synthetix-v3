const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');

const { getSourcesAST } = require('../internal/ast/ast-sources');
const {
  findDuplicateStorageNamespaces,
  findRegularStorageSlots,
  findInvalidMutationsOnNamespaces,
} = require('../internal/ast/namespaces-validator');
const { SUBTASK_VALIDATE_STORAGE, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating Storage usage');

  const { contracts } = await getSourcesAST(hre);

  let errorsFound;
  errorsFound = findDuplicateStorageNamespaces(contracts) || errorsFound;
  errorsFound = findRegularStorageSlots(contracts) || errorsFound;
  errorsFound = findInvalidMutationsOnNamespaces(contracts) || errorsFound;

  if (errorsFound) {
    logger.error('Storate usage is not valid');
    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }
  logger.checked('Namespaces are valid');
});
