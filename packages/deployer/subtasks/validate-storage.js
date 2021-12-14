const { subtask } = require('hardhat/config');
const mapValues = require('just-map-values');
const logger = require('@synthetixio/core-js/utils/io/prompter');
const prompter = require('@synthetixio/core-js/utils/prompter');
const ModuleStorageASTValidator = require('../internal/storage-ast-validator');
const { ContractValidationError } = require('../internal/errors');
const { SUBTASK_VALIDATE_STORAGE } = require('../task-names');

subtask(SUBTASK_VALIDATE_STORAGE).setAction(async (_, hre) => {
  logger.subtitle('Validating module storage usage');

  const { deployment, previousDeployment } = hre.deployer;

  const asts = mapValues(deployment.sources, (val) => val.ast);
  const previousAsts =
    previousDeployment && mapValues(previousDeployment.sources, (val) => val.ast);
  const validator = new ModuleStorageASTValidator(asts, previousAsts);

  let errorsFound = [];
  errorsFound.push(...validator.findNamespaceCollisions());
  errorsFound.push(...validator.findRegularVariableDeclarations());
  errorsFound.push(...(await validator.findInvalidNamespaceMutations()));

  let warningsFound = [];
  warningsFound.push(...validator.findNamespaceSlotChanges());

  if (warningsFound.length > 0) {
    for (let warning of warningsFound) {
      await prompter.ask(`Warning: ${warning.msg}. Do you wish to continue anyway?`);
    }
  }

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    if (logger.debug) {
      errorsFound.map((err) => console.log(JSON.stringify(err, null, 2)));
    }

    throw new ContractValidationError(
      `Invalid storage usage: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Storage layout is valid');
});
