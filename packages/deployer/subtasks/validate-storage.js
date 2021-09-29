const { subtask } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/logger');
const { getAllContractASTs, getAllPreviousContractASTs } = require('../utils/deployments');
const ModuleStorageASTValidator = require('../internal/storage-ast-validator');
const { SUBTASK_VALIDATE_STORAGE, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating module storage usage');

  const asts = getAllContractASTs(hre);
  const previousAsts = getAllPreviousContractASTs(hre);
  const validator = new ModuleStorageASTValidator(asts, previousAsts);

  let errorsFound = [];
  errorsFound.push(...validator.findNamespaceCollisions());
  errorsFound.push(...validator.findRegularVariableDeclarations());
  errorsFound.push(...(await validator.findInvalidNamespaceMutations()));

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Storage layout is valid');
});
