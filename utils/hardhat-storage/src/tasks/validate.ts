import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { validateSlotNamespaceCollisions } from '../internal/validate-namespace';
import { validateMutableStateVariables } from '../internal/validate-variables';
import { TASK_STORAGE_VALIDATE } from '../task-names';

task(
  TASK_STORAGE_VALIDATE,
  'Validate state variables usage and storage slot names behind routers'
).setAction(async (_, hre) => {
  const now = Date.now();
  logger.subtitle('Validating store');

  for (const contract of hre.config.storage.artifacts) {
    logger.info(contract);
  }

  const allFqNames = await hre.artifacts.getAllFullyQualifiedNames();
  const fqNamesToValidate = filterContracts(allFqNames, hre.config.storage.artifacts);

  const getArtifact = (fqName: string) => readHardhatArtifact(hre, fqName);

  const errors = await Promise.all([
    validateMutableStateVariables({
      contracts: fqNamesToValidate,
      getArtifact,
    }),
    validateSlotNamespaceCollisions({
      contracts: fqNamesToValidate,
      getArtifact,
    }),
  ]).then((result) => result.flat());

  errors.forEach((err) => console.error(err, '\n'));

  if (errors.length) {
    throw new HardhatPluginError('hardhat-storage', 'Storage validation failed');
  }

  logger.success(`state variables and storage slots valid (${Date.now() - now}ms)`);
});
