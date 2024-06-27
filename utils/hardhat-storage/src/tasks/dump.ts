import path from 'node:path';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { dumpStorage } from '../internal/dump';
import { writeJsonFile } from '../internal/file-helpers';
import { logInChunks } from '../internal/log-in-chunks';
import { TASK_STORAGE_DUMP } from '../task-names';

interface Params {
  output: string;
  noValidate: boolean;
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
  .addFlag('quiet', 'only emit errors to the console')
  .addFlag('log', 'log json result to the console')
  .setAction(async (params: Params, hre) => {
    const { output, noValidate, log, quiet } = params;

    const now = Date.now();

    const { contracts, getArtifact } = await hre.runGetArtifacts();

    if (!noValidate) {
      await hre.runValidateContracts({ contracts, getArtifact });
    }

    const dump = await dumpStorage({ contracts, getArtifact });

    if (output) {
      await writeJsonFile(path.resolve(hre.config.paths.root, output), dump);
    }

    if (log) {
      logInChunks(dump);
    } else if (!quiet) {
      logger.success(`Storage dump finished in ${Date.now() - now}ms`);
    }

    return dump;
  });
