const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const { subtask } = require('hardhat/config');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getSourceModules } = require('../utils/getSourceModules');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

/*
 * Prepares the deployment file associated with the active deployment.
 * */
subtask(SUBTASK_PREPARE_DEPLOYMENT).setAction(async (_, hre) => {
  logger.subtitle('Preparing deployment');

  if (!hre.deployer) {
    hre.deployer = {};
  }

  hre.deployer.data = readDeploymentFile({ hre });
  hre.deployer.sources = getSourceModules({ hre });

  await prompter.confirmAction('Continue');
});
