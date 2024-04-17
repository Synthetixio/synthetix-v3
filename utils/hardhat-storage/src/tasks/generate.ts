import fs from 'node:fs/promises';
import path from 'node:path';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import { getContractsFullyQualifiedNames } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { HardhatConfig } from 'hardhat/types/config';
import { dumpStorage } from '../internal/dump';
import { validate } from '../internal/validate';
import { writeInChunks } from '../internal/write-in-chunks';
import {
  SUBTASK_STORAGE_GET_SOURCE_UNITS,
  SUBTASK_STORAGE_PARSE_CONTENTS,
  TASK_STORAGE_GENERATE,
} from '../task-names';

interface Params {
  artifacts?: string[];
  skip?: string[];
  output?: string;
  noCompile: boolean;
}

type ExtendedHardhatConfig = HardhatConfig & { storage: Params };

task(
  TASK_STORAGE_GENERATE,
  'Validate all the contracts against existing storage dump and, if valid, update it'
)
  .addOptionalParam(
    'artifacts',
    'Contract files, names, fully qualified names or folder of contracts to include',
    ['contracts/**'],
    types.stringArray
  )
  .addOptionalParam(
    'skip',
    'Optional whitelist of contracts to skip the validations',
    [],
    types.stringArray
  )
  .addOptionalParam(
    'output',
    'Storage dump output file relative to the root of the project',
    'storage.dump.sol'
  )
  .addFlag('noCompile', 'Do not execute hardhat compile before build')
  .setAction(async (params: Required<Params>, hre) => {
    const userOverrideConfig = (hre.config as ExtendedHardhatConfig).storage ?? {};

    const artifacts = userOverrideConfig.artifacts ?? params.artifacts;
    const skip = userOverrideConfig.skip ?? params.skip;
    const output = userOverrideConfig.output ?? params.output;

    if (!output) {
      logger.quiet = true;
    }

    const now = Date.now();
    logger.subtitle('Generating storage dump');

    for (const contract of artifacts) {
      logger.info(contract);
    }

    if (!params.noCompile) {
      await hre.run('compile', { quiet: true, force: true });
    }

    const allContracts = await getContractsFullyQualifiedNames(hre, artifacts);

    console.log({ allContracts });

    const sourceUnits = await hre.run(SUBTASK_STORAGE_GET_SOURCE_UNITS, {
      artifacts: allContracts,
    });

    const errors = validate({ sourceUnits, skip });

    errors.forEach((err) => console.error(err, '\n'));

    if (errors.length) {
      throw new HardhatPluginError('hardhat-storage', 'Storage validation failed');
    }

    const dump = await dumpStorage(sourceUnits);

    // Sanity check to verify that the generated dump is parseable
    await hre.run(SUBTASK_STORAGE_PARSE_CONTENTS, {
      contents: {
        [output]: dump,
      },
    });

    if (output) {
      const target = path.resolve(hre.config.paths.root, output);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, dump);

      logger.success(`Storage dump written to ${output} in ${Date.now() - now}ms`);
    } else {
      writeInChunks(dump);
    }

    return dump;
  });
