import path from 'path';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { resetHardhatContext } from 'hardhat/plugins-testing';

const cache: { [path: string]: any } = {};

/**
 * Helper function to be able to get the ASTs of a given hardhat project, and
 * after compiling it returns the current running environment to its original state.
 * @param {string} envPath
 */
export default async function parseContracts(envPath: string) {
  envPath = path.resolve(envPath);

  if (cache[envPath]) return cache[envPath];

  cache[envPath] = {};

  resetHardhatContext();

  const originalChdir = process.cwd();
  process.chdir(envPath);

  const hre = await import('hardhat');

  await hre.run(TASK_COMPILE, { force: true, quiet: true });

  const fullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();

  const asts: { [key: string]: any } = {};

  for (const fullyQualifiedName of fullyQualifiedNames) {
    const buildInfo = await hre.artifacts.getBuildInfo(fullyQualifiedName);

    if (!buildInfo) {
      // shouldn't be able to happen
      throw new Error('buildInfo not found from fully qualified name');
    }

    for (const [sourceName, attributes] of Object.entries(
      buildInfo.output.sources
    )) {
      asts[sourceName] = attributes.ast;
    }
  }

  resetHardhatContext();
  process.chdir(originalChdir);

  cache[envPath].asts = asts;

  return cache[envPath];
}
