import path from 'node:path';
import { subtask } from 'hardhat/config';
import { findClosestPackageJson, getPackageName } from 'hardhat/internal/util/packageInfo';
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
      const sourceFullPath = path.join(hre.config.paths.root, sourceName);
      const isLocalSource = sourceFullPath.startsWith(`${hre.config.paths.sources}${path.sep}`);

      if (isLocalSource) {
        return getArtifact(hre.config.paths.root, sourceName, contractName);
      } else {
        const sourceFullPath = require.resolve(sourceName);
        const projectPackageJson = await findClosestPackageJson(sourceFullPath);

        if (!projectPackageJson) {
          throw new Error(`Could not find project root for "${sourceName}"`);
        }

        const dependencyRoot = path.dirname(projectPackageJson);
        const packageName = await getPackageName(projectPackageJson);
        const localSourceName = sourceName.slice(packageName.length + 1);

        return getArtifact(dependencyRoot, localSourceName, contractName);
      }
    })
  );

  return artifacts.filter(Boolean);
});
