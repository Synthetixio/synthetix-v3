import path from 'node:path';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { task } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { getSourcesFullyQualifiedNames } from '../internal/contract-helper';
import { SUBTASK_GENERATE_TESTABLE_STORAGE, TASK_GENERATE_TESTABLE } from '../task-names';

export interface DeployTaskParams {
  artifacts?: string[];
  debug?: boolean;
  quiet?: boolean;
}

task(TASK_GENERATE_TESTABLE, 'Creates generated test contracts for all storage libraries')
  .addOptionalPositionalParam(
    'artifacts',
    'Contract files, names, fully qualified names or folder of contracts to include',
    ['contracts/storage/'],
    types.stringArray
  )
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .setAction(async (taskArguments: DeployTaskParams, hre) => {
    const { artifacts, debug, quiet } = taskArguments;

    logger.quiet = !!quiet;
    logger.debugging = !!debug;

    const storageLibs = await getSourcesFullyQualifiedNames(hre, artifacts);

    logger.info(`Generating testable storage for ${storageLibs.length} contracts`);

    // scan for all storage interfaces
    for (const contractFullyQualifiedName of storageLibs) {
      const { contractName } = parseFullyQualifiedName(contractFullyQualifiedName);

      await hre.run(SUBTASK_GENERATE_TESTABLE_STORAGE, {
        artifact: contractFullyQualifiedName,
        output: path.resolve(
          hre.config.paths.sources,
          `modules/test/Testable${contractName}Module.sol`
        ),
      });
    }
  });
