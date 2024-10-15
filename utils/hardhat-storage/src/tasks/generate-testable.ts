import fs from 'node:fs/promises';
import path from 'node:path';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName, parseName } from 'hardhat/utils/contract-names';
import micromatch from 'micromatch';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { quietCompile } from '../internal/quiet-compile';
import { SUBTASK_GENERATE_TESTABLE_STORAGE, TASK_GENERATE_TESTABLE } from '../task-names';

export interface DeployTaskParams {
  artifacts?: string[];
  outputFolder?: string;
  debug?: boolean;
  quiet?: boolean;
}

const DEFAULT_OUTPUT_FOLDER = 'generated/test/';

/**
 * Get a list of all the contracts fully qualified names that are present or imported
 * on the local contracts/ folder.
 * It can include a whitelist filter by contractName, contractSource,
 * or if its included in a given folder.
 */
export async function getContractsFullyQualifiedNames(
  hre: HardhatRuntimeEnvironment,
  patterns: string[] = ['*']
) {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();
  return filterContracts(contractFullyQualifiedNames, patterns);
}

/**
 * Filter the given contracts using multimatch. It can include a whitelist filter
 * by contractName, contractSource, or if its included in a given folder.
 */
export function filterContracts(contracts: string[], patterns: string[] = ['*']) {
  if (patterns.length === 1 && /^\*+$/.test(patterns[0])) {
    return [...contracts];
  }

  const matches = (items: string[], patterns: string[]) => micromatch(items, patterns).length > 0;

  const blacklist = patterns.filter((w) => w.startsWith('!')).map((b) => b.slice(1));
  const whitelist = patterns.filter((w) => !w.startsWith('!'));

  return contracts.filter((name) => {
    const { sourceName, contractName } = parseName(name);
    const item = [name, contractName];
    if (sourceName) item.push(sourceName);
    return !matches(item, blacklist) && matches(item, whitelist);
  });
}

task(TASK_GENERATE_TESTABLE, 'Creates generated test contracts for all storage libraries')
  .addOptionalPositionalParam(
    'artifacts',
    'Contract files, names, fully qualified names or folder of contracts to include',
    ['contracts/storage/*'],
    types.stringArray
  )
  .addOptionalParam(
    'outputFolder',
    'Where to store all the testable contracts inside the sources folder',
    DEFAULT_OUTPUT_FOLDER
  )
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .setAction(async (taskArguments: DeployTaskParams, hre) => {
    const { artifacts, outputFolder = DEFAULT_OUTPUT_FOLDER, debug, quiet } = taskArguments;

    logger.quiet = !!quiet;
    logger.debugging = !!debug;

    await quietCompile(hre, true);

    const output = path.resolve(hre.config.paths.sources, outputFolder);
    const storageLibs = await getContractsFullyQualifiedNames(hre, artifacts);

    logger.info(`Generating testable storage for ${storageLibs.length} contracts`);

    await fs.mkdir(output, { recursive: true });

    // Delete old testable contracts
    for (const f of await fs.readdir(output)) {
      if (f.startsWith('Testable')) {
        await fs.unlink(path.join(output, f));
      }
    }

    // scan for all storage interfaces
    for (const contractFullyQualifiedName of storageLibs) {
      const { contractName } = parseFullyQualifiedName(contractFullyQualifiedName);

      await hre.run(SUBTASK_GENERATE_TESTABLE_STORAGE, {
        artifact: contractFullyQualifiedName,
        output: path.join(output, `Testable${contractName}Storage.sol`),
      });
    }
  });
