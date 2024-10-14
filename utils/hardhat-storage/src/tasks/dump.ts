import path from 'node:path';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { dumpStorage } from '../internal/dump';
import { readJsonFileSafe, writeJsonFile } from '../internal/file-helpers';
import { logInChunks } from '../internal/log-in-chunks';
import {
  TASK_STORAGE_DUMP,
  SUBTASK_GET_ARTIFACTS,
  SUBTASK_VALIDATE_CONTRACTS,
  SUBTASK_VERIFY_CONTRACTS,
} from '../task-names';
import { StorageDump } from '../types';

interface Params {
  output: string;
  noValidate: boolean;
  noVerify: boolean;
  quiet: boolean;
  log: boolean;
}

task(TASK_STORAGE_DUMP, 'Dump storage slots to a file')
  .addOptionalParam(
    'output',
    'Storage dump output file relative to the root of the project',
    'storage.dump.json'
  )
  .addFlag('noValidate', 'Do not perform static validations on contracts before generating')
  .addFlag('noVerify', 'Do not verify storage mutations before replacing dump')
  .addFlag('quiet', 'only emit errors to the console')
  .addFlag('log', 'log json result to the console')
  .setAction(async (params: Params, hre) => {
    const { output, noValidate, noVerify, log, quiet } = params;

    const now = Date.now();
    const target = path.resolve(hre.config.paths.root, output);

    await hre.run('compile');

    const { contracts, getArtifact } = await hre.run(SUBTASK_GET_ARTIFACTS);

    if (!noValidate) {
      await hre.run(SUBTASK_VALIDATE_CONTRACTS, { contracts, getArtifact });
    }

    const dump = await dumpStorage({ contracts, getArtifact });

    if (!noVerify) {
      const prev = await readJsonFileSafe<StorageDump>(target);
      await hre.run(SUBTASK_VERIFY_CONTRACTS, {
        curr: dump,
        prev,
        quiet: log || quiet,
      });
    }

    if (output && dump) {
      await writeJsonFile(target, dump);
    }

    if (log) {
      if (dump) logInChunks(dump);
    } else if (!quiet) {
      logger.success(`Storage dump finished in ${Date.now() - now}ms`);
    }

    return dump;
  });
