import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import {
  SUBTASK_GET_ARTIFACTS,
  SUBTASK_VALIDATE_CONTRACTS,
  TASK_STORAGE_VALIDATE,
} from '../task-names';

task(
  TASK_STORAGE_VALIDATE,
  'Validate state variables usage and storage slot names behind routers'
).setAction(async (_, hre) => {
  const now = Date.now();

  logger.subtitle('Validating store');

  for (const contract of hre.config.storage.artifacts) {
    logger.info(contract);
  }

  const { contracts, getArtifact } = await hre.run(SUBTASK_GET_ARTIFACTS);
  await hre.run(SUBTASK_VALIDATE_CONTRACTS, { contracts, getArtifact });

  logger.success(`state variables and storage slots valid (${Date.now() - now}ms)`);
});
