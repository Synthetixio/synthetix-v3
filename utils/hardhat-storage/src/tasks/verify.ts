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
import {
  SUBTASK_STORAGE_GET_SOURCE_UNITS,
  SUBTASK_STORAGE_PARSE_CONTENTS,
  SUBTASK_STORAGE_PARSE_DUMP,
  TASK_STORAGE_VERIFY,
} from '../task-names';

interface Params {
  artifacts?: string[];
  skip?: string[];
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
  .addFlag('log', 'Show the result in the console')
  .addFlag('noSave', 'Do not update storage dump file')
  .setAction(async (params: Required<Params>, hre) => {
    const userOverrideConfig = (hre.config as ExtendedHathatConfig).storage ?? {};

    const artifacts = userOverrideConfig.artifacts ?? params.artifacts;
    const skip = userOverrideConfig.skip ?? params.skip;
    const output = userOverrideConfig.output ?? params.output;
    const log = userOverrideConfig.log ?? params.log;
    const noSave = userOverrideConfig.noSave ?? params.noSave;

    if (log) {
      logger.quiet = true;
    }

    const now = Date.now();
    logger.subtitle('Validating storage');

    for (const contract of artifacts) {
      logger.info(contract);
    }

    await hre.run('compile', { quiet: true, force: true });

    const allContracts = await getContractsFullyQualifiedNames(hre, artifacts);

    const sourceUnits = await hre.run(SUBTASK_STORAGE_GET_SOURCE_UNITS, {
      artifacts: allContracts,
    });
    const prevSourceUnits = await hre.run(SUBTASK_STORAGE_PARSE_DUMP, { output });

    const errors = validate({ sourceUnits, prevSourceUnits, skip });

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
