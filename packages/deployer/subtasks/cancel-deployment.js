const del = require('del');
const { subtask } = require('hardhat/config');
const { default: logger } = require('@synthetixio/core-js/utils/io/logger');
const { default: relativePath } = require('@synthetixio/core-js/utils/misc/relative-path');
const { SUBTASK_CANCEL_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_CANCEL_DEPLOYMENT,
  'Stop current deployment execution and delete created data files'
).setAction(async (_, hre) => {
  const toDelete = [
    hre.deployer.paths.deployment,
    hre.deployer.paths.sources,
    hre.deployer.paths.abis,
  ];

  logger.info('Deleting generated files:');
  toDelete.forEach((file) => logger.info(`  ${relativePath(file)}`));

  await del(toDelete);

  logger.info('Exiting...');
});
