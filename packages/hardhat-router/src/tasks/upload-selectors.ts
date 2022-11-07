import { task } from 'hardhat/config';
import { default as logger } from '@synthetixio/core-utils/utils/io/logger';
import { JsonFragment } from '@ethersproject/abi';
import * as fourbytes from '../internal/fourbytes';
import { TASK_UPLOAD_SELECTORS, SUBTASK_GET_SOURCES_ABIS } from '../task-names';
import { DeploymentAbis } from '../types';

interface Params {
  include: string;
  quiet: boolean;
  debug: boolean;
}

task(TASK_UPLOAD_SELECTORS, 'Upload selectors from all local contracts to 4byte.directory')
  .addOptionalParam('include', 'optional comma separated contracts to include', '')
  .addFlag('debug', 'Display debug logs')
  .addFlag('quiet', 'Silence all output')
  .setAction(async ({ include, quiet, debug }: Params, hre) => {
    const whitelist = include
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    logger.quiet = quiet;
    logger.debugging = debug;

    const abis = (await hre.run(SUBTASK_GET_SOURCES_ABIS, { whitelist })) as DeploymentAbis;
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
