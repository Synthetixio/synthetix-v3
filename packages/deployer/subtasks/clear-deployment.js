const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');

const logger = require('../utils/logger');
const { SUBTASK_CLEAR_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_CLEAR_DEPLOYMENT,
  'Clear the current running deploy task generated files'
).setAction(async (_, hre) => {
  logger.info('Deletig generated deployment files: ');

  logger.info(`Deleting ${hre.deployer.file}`);
  rimraf.sync(hre.deployer.file);

  process.exit(0);
});
