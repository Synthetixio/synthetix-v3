import { subtask } from 'hardhat/config';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { SUBTASK_STORAGE_GET_SOURCE_UNITS } from '../task-names';

interface Params {
  fqNames: string[];
}

subtask(SUBTASK_STORAGE_GET_SOURCE_UNITS).setAction(async ({ fqNames }: Params, hre) => {
  const artifacts = await Promise.all(fqNames.map((fqName) => readHardhatArtifact(hre, fqName)));
  return artifacts.filter(Boolean);
});
