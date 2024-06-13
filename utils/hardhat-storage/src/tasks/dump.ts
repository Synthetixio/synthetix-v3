import path from 'node:path';
import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { dumpStorage } from '../internal/dump';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { logInChunks } from '../internal/log-in-chunks';
import { TASK_STORAGE_DUMP, TASK_STORAGE_VALIDATE } from '../task-names';
import { writeJsonFile } from '../internal/write-json-file';

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

    if (!noValidate) {
      await hre.run(TASK_STORAGE_VALIDATE, { quiet: true });
    }

    const allFqNames = await hre.artifacts.getAllFullyQualifiedNames();
    const contracts = filterContracts(allFqNames, hre.config.storage.artifacts);
    const getArtifact = (fqName: string) => readHardhatArtifact(hre, fqName);

    const dump = await dumpStorage({ getArtifact, contracts });

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
