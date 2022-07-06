const { task } = require('hardhat/config');
const logger = require('@synthetixio/core-js/utils/io/logger');
const axios = require('axios');
const { TASK_UPLOAD_SELECTORS, SUBTASK_GET_SOURCES_ABIS } = require('../task-names');

const API_ENDPOINT = 'https://www.4byte.directory/api/v1/import-abi/';

task(TASK_UPLOAD_SELECTORS, 'Upload selectors from all local contracts to 4byte.directory')
  .addOptionalParam('include', 'optional comma separated contracts to include', '')
  .addFlag('debug', 'Display debug logs', false)
  .addFlag('quiet', 'Silence all output', false)
  .setAction(async ({ include, quiet, debug }, hre) => {
    const whitelist = include
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    logger.quiet = quiet;
    logger.debugging = debug;

    const abis = await hre.run(SUBTASK_GET_SOURCES_ABIS, { whitelist });
    const abiValues = Object.values(abis);

    if (!abiValues.length) {
      throw new Error('No contracts found.');
    }

    const items = {};
    for (const item of abiValues.flat()) {
      if (item.type !== 'function' && item.type !== 'event') continue;
      items[JSON.stringify(item)] = item;
    }

    const { data } = await axios({
      method: 'post',
      url: API_ENDPOINT,
      headers: { 'Content-Type': 'application/json' },
      data: {
        contract_abi: JSON.stringify(Object.values(items)),
      },
    });

    logger.info(`Processed ${data.num_processed} unique items from ${abiValues.length} ABIs`);
    logger.info(`Added ${data.num_imported} selectors to database`);
    logger.info(`Found ${data.num_duplicates} duplicates`);
    logger.info(`Ignored ${data.num_ignored} items`);
  });
