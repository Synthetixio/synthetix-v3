const del = require('del');
const { default: logger } = require('@synthetixio/core-js/utils/io/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_FINALIZE_DEPLOYMENT } = require('../task-names');

/*
 * Marks a deployment as completed, or deletes it if it didn't produce any changes.
 * */
subtask(SUBTASK_FINALIZE_DEPLOYMENT).setAction(async (_, hre) => {
  logger.subtitle('Finalizing deployment');

  if (hre.deployer.deployment.general.properties.totalGasUsed === '0') {
    logger.checked('Deployment did not produce any changes, deleting temp files');

    const toDelete = [
      hre.deployer.paths.deployment,
      hre.deployer.paths.sources,
      hre.deployer.paths.abis,
    ];

    await del(toDelete);
  } else {
    logger.complete('Deployment marked as completed');

    hre.deployer.deployment.general.properties.completed = true;
  }
});
