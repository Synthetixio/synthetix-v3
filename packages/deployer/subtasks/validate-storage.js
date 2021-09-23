const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getSourcesAST } = require('../internal/ast/ast-sources');
const {
  findDuplicateStorageNamespaces,
  findUnsafeStorageUsageInModules,
  findInvalidMutationsOnNamespaces,
} = require('../internal/ast/storage-validator');
const { SUBTASK_VALIDATE_STORAGE, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating Storage usage');

  const { contracts } = await getSourcesAST(hre);

  let errorsFound = [];
  errorsFound.push(...findDuplicateStorageNamespaces(contracts));
  errorsFound.push(...findUnsafeStorageUsageInModules(contracts));
  errorsFound.push(...findInvalidMutationsOnNamespaces(contracts));

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Storage layout is valid');
});
