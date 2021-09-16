const del = require('del');
const { subtask } = require('hardhat/config');

const logger = require('@synthetixio/core-js/utils/logger');
const prompter = require('@synthetixio/core-js/utils/prompter');
const { getDeploymentFolder } = require('../utils/deployments');
const { getGeneratedContractPaths } = require('../internal/generate-contracts');
const { SUBTASK_CLEAR_DEPLOYMENTS } = require('../task-names');

subtask(
  SUBTASK_CLEAR_DEPLOYMENTS,
  'Delete all previous deployment data on the current environment'
).setAction(async ({ instance }, hre) => {
  const deploymentsFolder = getDeploymentFolder({
    folder: hre.config.deployer.paths.deployments,
    network: hre.network.name,
    instance,
  });

  const generatedContracts = getGeneratedContractPaths(hre.config);

  const toDelete = [deploymentsFolder, ...generatedContracts];

  logger.warn('Received --clear parameter. This will delete all previous deployment data:');

  toDelete.forEach(logger.notice.bind(logger));

  await prompter.confirmAction('Are you sure you want to delete all?');

  await del(toDelete);
});
