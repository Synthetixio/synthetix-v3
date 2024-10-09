import path from 'node:path';
import { findClosestPackageJson, getPackageName } from 'hardhat/internal/util/packageInfo';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import memoize from 'lodash.memoize';
import { readArtifact } from './artifacts';
import { ensureTrailingSlash } from './path-helpers';

export const readArtifactCached = memoize(readArtifact, (...args) =>
  args.join(',')
) as typeof readArtifact;

export async function readHardhatArtifact(hre: HardhatRuntimeEnvironment, sourceName: string) {
  const sourceFullPath = path.join(hre.config.paths.root, sourceName);
  const isLocalSource = sourceFullPath.startsWith(ensureTrailingSlash(hre.config.paths.sources));

  if (isLocalSource) {
    return readArtifactCached(hre.config.paths.root, sourceName);
  } else {
    const sourceFullPath = require.resolve(sourceName);
    const projectPackageJson = findClosestPackageJson(sourceFullPath);

    if (!projectPackageJson) {
      throw new Error(`Could not find project root for "${sourceName}"`);
    }

    const dependencyRoot = path.dirname(projectPackageJson);
    const packageName = await getPackageName(projectPackageJson);

    return readArtifactCached(dependencyRoot, sourceName, packageName);
  }
}
