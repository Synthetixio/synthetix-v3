import fs from 'node:fs/promises';
import path from 'node:path';
import { filterContracts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { dumpStorage } from '../internal/dump';
import { readHardhatArtifact } from '../internal/read-hardhat-artifact';
import { writeInChunks } from '../internal/write-in-chunks';
import { TASK_STORAGE_DUMP, TASK_STORAGE_VALIDATE } from '../task-names';

interface Params {
  output: string;
  noValidate: boolean;
  log: boolean;
}

task(TASK_STORAGE_DUMP, 'Dump storage slots to a file')
  .addOptionalParam(
    'output',
    'Storage dump output file relative to the root of the project',
    'storage.dump.sol'
  )
  .addFlag('noValidate', 'Do not perform static validations on contracts before generating')
  .addFlag('log', 'log json result to the console')
  .setAction(async (params: Params, hre) => {
    const { noValidate, log } = params;

    const now = Date.now();

    if (!log) {
      logger.subtitle('Generating storage dump');
    }

    if (log) {
      logger.quiet = true;
    }

    if (!noValidate) {
      await hre.run(TASK_STORAGE_VALIDATE);
    }

    const allFqNames = await hre.artifacts.getAllFullyQualifiedNames();
    const contracts = filterContracts(allFqNames, hre.config.storage.artifacts);
    const getArtifact = (fqName: string) => readHardhatArtifact(hre, fqName);

    const dump = await dumpStorage({ contracts, getArtifact });

    // if (output) {
    //   const target = path.resolve(hre.config.paths.root, output);
    //   await fs.mkdir(path.dirname(target), { recursive: true });
    //   await fs.writeFile(target, dump);

    //   logger.success(`Storage dump written to ${output} in ${Date.now() - now}ms`);
    // }

    if (log) {
      writeInChunks(dump);
    } else {
      logger.success(`Storage dump finished in ${Date.now() - now}ms`);
    }

    return dump;
  });
