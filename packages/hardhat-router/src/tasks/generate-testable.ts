import { task } from 'hardhat/config';
import { default as logger } from '@synthetixio/core-utils/utils/io/logger';
import { default as prompter } from '@synthetixio/core-utils/utils/io/prompter';
import { readPackageJson } from '@synthetixio/core-utils/utils/misc/npm';
import {
  SUBTASK_GENERATE_TESTABLE_STORAGE,
  SUBTASK_SYNC_SOURCES,
  TASK_GENERATE_TESTABLE,
} from '../task-names';
import { quietCompile } from '../utils/quiet-compile';

export interface DeployTaskParams {
  noConfirm?: boolean;
  skipProxy?: boolean;
  debug?: boolean;
  quiet?: boolean;
  clear?: boolean;
  alias?: string;
  modules?: string;
  instance?: string;
}

task(TASK_GENERATE_TESTABLE, 'Creates generated test contracts for all storage libraries')
  .addFlag('noConfirm', 'Skip all confirmation prompts')
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .setAction(async (taskArguments: DeployTaskParams, hre) => {
    const { debug, quiet, noConfirm } = taskArguments;

    logger.quiet = !!quiet;
    logger.debugging = !!debug;
    prompter.noConfirm = !!noConfirm;

    // Do not throw an error on missing package.json
    // This is so we don't force the user to have the file on tests just for the name
    try {
      await logger.title(readPackageJson().name);
    } catch (err: unknown) {
      if ((err as { code: string }).code !== 'ENOENT') throw err;
    }

    await logger.title('DEPLOYER');

    await quietCompile(hre, !!quiet);
    //await hre.run(SUBTASK_LOAD_DEPLOYMENT, { instance: 'general', ...taskArguments });
    hre.router.deployment = {
      general: {
        properties: { completed: false, totalGasUsed: '0' },
        transactions: {},
        contracts: {},
      },
      sources: {},
      abis: {},
    };

    await hre.run(SUBTASK_SYNC_SOURCES, taskArguments);

    const storageLibs = Object.values(hre.router.deployment!.general.contracts).filter(
      ({ isStorageLibrary }) => isStorageLibrary
    );

    // scan for all storage interfaces
    for (const storageLibArtifact of storageLibs) {
      await hre.run(SUBTASK_GENERATE_TESTABLE_STORAGE, {
        artifact: storageLibArtifact.contractFullyQualifiedName,
        output: `contracts/modules/test/Testable${storageLibArtifact.contractName}Module.sol`,
      });
    }
  });
