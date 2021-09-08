const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');

const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { getGeneratedContractPaths } = require('../utils/deployments');
const { SUBTASK_CLEAR_DEPLOYMENT } = require('../task-names');

subtask(
  SUBTASK_CLEAR_DEPLOYMENT,
  'Delete all previous deployment data on the current environment'
).setAction(async (_, hre) => {
  const deploymentsFolder = hre.config.deployer.paths.deployments;
  const generatedContracts = getGeneratedContractPaths(hre.config);

  const toDelete = [deploymentsFolder, ...generatedContracts];

  logger.warn('Received --clear parameter. This will delete all previous deployment data:');

  toDelete.forEach(logger.notice.bind(logger));

  await prompter.confirmAction('Are you sure you want to delete all?');

  toDelete.forEach((pathname) => rimraf.sync(pathname));
});
