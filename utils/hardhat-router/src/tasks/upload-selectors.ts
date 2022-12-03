import { JsonFragment } from '@ethersproject/abi';
import * as types from '@synthetixio/core-utils/utils/hardhat/argument-types';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';
import { getSourcesAbis } from '../internal/contract-helper';
import * as fourbytes from '../internal/fourbytes';
import { TASK_UPLOAD_SELECTORS } from '../task-names';

interface Params {
  modules: string[];
  quiet: boolean;
  debug: boolean;
}

task(TASK_UPLOAD_SELECTORS, 'Upload selectors from all local contracts to 4byte.directory')
  .addOptionalPositionalParam(
    'modules',
    'Contract files, names, fully qualified names or folder of contracts to include',
    ['contracts/modules/'],
    types.stringArray
  )
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .setAction(async ({ modules, quiet, debug }: Params, hre) => {
    await hre.run(TASK_COMPILE, { force: false, quiet: true });

    logger.quiet = !!quiet;
    logger.debugging = !!debug;

    const abis = await getSourcesAbis(hre, modules);
    const abiValues = Object.values(abis);

    if (!abiValues.length) {
      throw new Error('No contracts found');
    }

    const items: { [k: string]: JsonFragment } = {};
    for (const item of abiValues.flat()) {
      if (item.type !== 'function' && item.type !== 'event') continue;
      items[JSON.stringify(item)] = item;
    }

    const data = await fourbytes.importAbi(Object.values(items));

    logger.info(`Processed ${data.num_processed} unique items from ${abiValues.length} ABIs`);
    logger.info(`Added ${data.num_imported} selectors to database`);
    logger.info(`Found ${data.num_duplicates} duplicates`);
    logger.info(`Ignored ${data.num_ignored} items`);
  });
