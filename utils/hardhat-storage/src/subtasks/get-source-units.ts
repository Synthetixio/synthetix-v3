import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { getArtifact } from '../internal/get-artifact';
import { SUBTASK_STORAGE_GET_SOURCE_UNITS } from '../task-names';

interface Params {
  fqNames: string[];
}

subtask(SUBTASK_STORAGE_GET_SOURCE_UNITS).setAction(async ({ fqNames }: Params, hre) => {
  const artifacts = await Promise.all(
    fqNames.map(async (fqName) => {
      const { sourceName, contractName } = parseFullyQualifiedName(fqName);
      return getArtifact(hre.config.paths.root, sourceName, contractName);
    })
  );

  return artifacts;
});
