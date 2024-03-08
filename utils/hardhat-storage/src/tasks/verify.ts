import fs from 'node:fs/promises';
import path from 'node:path';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { HardhatConfig } from 'hardhat/types/config';
import { dumpStorage } from '../internal/dump';
import { validate } from '../internal/validate';
import {
  SUBTASK_STORAGE_GET_SOURCE_UNITS,
  SUBTASK_STORAGE_PARSE_CONTENTS,
  SUBTASK_STORAGE_PARSE_DUMP,
  TASK_STORAGE_VERIFY,
} from '../task-names';

interface Params {
  contracts?: string[];
  output?: string;
  noSave?: boolean;
  log?: boolean;
}

type ExtendedHathatConfig = HardhatConfig & { storage: Params };

task(
  TASK_STORAGE_VERIFY,
  'Validate all the contracts against existing storage dump and, if valid, update it'
)
  .addOptionalParam(
    'contracts',
    'Optional whitelist of contracts to get the storage values from',
    [
      'contracts/**',
      '!contracts/routers/**',
      '!contracts/generated/**',
      '!contracts/mocks/**',
      '!contracts/Router.sol',
    ],
    types.stringArray
  )
  .addOptionalParam(
    'output',
    'Storage dump output file relative to the root of the project',
    'storage.dump.sol'
  )
  .addFlag('log', 'Show the result in the console')
  .addFlag('noSave', 'Do not update storage dump file')
  .setAction(async (params: Required<Params>, hre) => {
    const userOverrideConfig = (hre.config as ExtendedHathatConfig).storage ?? {};

    const contracts = userOverrideConfig.contracts ?? params.contracts;
    const output = userOverrideConfig.output ?? params.output;
    const log = userOverrideConfig.log ?? params.log;
    const noSave = userOverrideConfig.noSave ?? params.noSave;

    const now = Date.now();
    logger.subtitle('Validating storage');

    for (const contract of contracts) {
      logger.info(contract);
    }

    await hre.run('compile', { quiet: true, force: true });

    const sourceUnits = await hre.run(SUBTASK_STORAGE_GET_SOURCE_UNITS, { contracts });
    const prevSourceUnits = await hre.run(SUBTASK_STORAGE_PARSE_DUMP, { output });

    const errors = validate({ sourceUnits, prevSourceUnits });

    errors.forEach((err) => console.error(err, '\n'));

    if (errors.length) {
      throw new HardhatPluginError('hardhat-storage', 'Storage validation failed');
    }

    const dump = await dumpStorage(sourceUnits);

    if (log) {
      console.log(dump);
    }

    // Sanity check to verify that the generated dump is parseable
    await hre.run(SUBTASK_STORAGE_PARSE_CONTENTS, {
      contents: {
        [output]: dump,
      },
    });

    if (!noSave) {
      const target = path.resolve(hre.config.paths.root, output);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, dump);

      logger.success(`Storage dump written to ${output} in ${Date.now() - now}ms`);
    }

    return dump;
  });
