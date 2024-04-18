import fs from 'node:fs/promises';
import path from 'node:path';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import { getContractsFullyQualifiedNames } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { dumpStorage } from '../internal/dump';
import { validateSlotNamespaceCollisions } from '../internal/validate-namespace';
import { validateMutableStateVariables } from '../internal/validate-variables';
import { writeInChunks } from '../internal/write-in-chunks';
import { SUBTASK_STORAGE_GET_SOURCE_UNITS, TASK_STORAGE_GENERATE } from '../task-names';

interface Params {
  artifacts?: string[];
  output: string;
  noCompile: boolean;
  log: boolean;
}

task(TASK_STORAGE_GENERATE, 'Validate state variables usage and dump storage slots to a file')
  .addOptionalParam(
    'artifacts',
    'Contract files, names, fully qualified names or folder of contracts to include',
    [],
    types.stringArray
  )
  .addOptionalParam(
    'output',
    'Storage dump output file relative to the root of the project',
    'storage.dump.sol'
  )
  .addFlag('noCompile', 'Do not execute hardhat compile before build')
  .addFlag('log', 'log json result to the console')
  .setAction(async (params: Required<Params>, hre) => {
    const artifacts = params.artifacts.length > 0 ? params.artifacts : hre.config.storage.artifacts;
    const { output, noCompile, log } = params;

    if (log) {
      logger.quiet = true;
    }

    const now = Date.now();
    logger.subtitle('Generating storage dump');

    for (const contract of artifacts) {
      logger.info(contract);
    }

    if (!noCompile) {
      await hre.run('compile', { quiet: true, force: true });
    }

    const allContracts = await getContractsFullyQualifiedNames(hre, artifacts);

    const sourceUnits = await hre.run(SUBTASK_STORAGE_GET_SOURCE_UNITS, {
      artifacts: allContracts,
    });

    const errors = [
      ...validateMutableStateVariables({
        artifacts: allContracts,
        sourceUnits,
      }),
      ...validateSlotNamespaceCollisions({ sourceUnits }),
    ];

    errors.forEach((err) => console.error(err, '\n'));

    if (errors.length) {
      throw new HardhatPluginError('hardhat-storage', 'Storage validation failed');
    }

    const dump = await dumpStorage(sourceUnits);

    if (output) {
      const target = path.resolve(hre.config.paths.root, output);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, dump);

      logger.success(`Storage dump written to ${output} in ${Date.now() - now}ms`);
    }

    if (log) {
      writeInChunks(dump);
    }

    return dump;
  });
