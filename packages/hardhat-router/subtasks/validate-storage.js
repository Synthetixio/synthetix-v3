const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-utils/dist/utils/io/logger');
const { default: prompter } = require('@synthetixio/core-utils/dist/utils/io/prompter');
const ModuleStorageASTValidator = require('../internal/storage-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_STORAGE } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating module storage usage');

  const moduleFullyQualifiedNames = Object.values(hre.router.deployment.general.contracts)
    .filter(({ isModule }) => isModule)
    .map((c) => c.contractFullyQualifiedName);
  const astNodes = Object.values(hre.router.deployment.sources).map((val) => val.ast);
  const previousAsts = hre.router.previousDeployment
    ? Object.values(hre.router.previousDeployment.sources).map((val) => val.ast)
    : [];

  const validator = new ModuleStorageASTValidator(
    moduleFullyQualifiedNames,
    astNodes,
    previousAsts
  );

  const errorsFound = [];
  errorsFound.push(...validator.findNamespaceCollisions());
  errorsFound.push(...validator.findRegularVariableDeclarations());
  errorsFound.push(...(await validator.findInvalidNamespaceMutations()));

  const warningsFound = [];
  warningsFound.push(...validator.findNamespaceSlotChanges());
  warningsFound.push(...(await validator.findNestedStructDeclarations()));

  for (const warning of warningsFound) {
    await prompter.ask(`Warning: ${warning.msg}. Do you wish to continue anyway?`);
  }

  if (errorsFound.length > 0) {
    for (const error of errorsFound) {
      logger.error(error.msg);
      logger.debug(JSON.stringify(error, null, 2));
    }

    throw new ContractValidationError(
      `Invalid storage usage: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Storage layout is valid');
});
