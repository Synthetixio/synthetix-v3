const { subtask } = require('hardhat/config');
const mapValues = require('just-map-values');
const logger = require('@synthetixio/core-js/utils/logger');
const ModuleStorageASTValidator = require('../internal/storage-ast-validator');
const { SUBTASK_VALIDATE_STORAGE, SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

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

  if (errorsFound.length > 0) {
    errorsFound.forEach((error) => {
      logger.error(error.msg);
    });

    return await hre.run(SUBTASK_CANCEL_DEPLOYMENT);
  }

  logger.checked('Storage layout is valid');
});
