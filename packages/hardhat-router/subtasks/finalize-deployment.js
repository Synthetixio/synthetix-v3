const del = require('del');
const { default: logger } = require('@synthetixio/core-utils/dist/utils/io/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_FINALIZE_DEPLOYMENT } = require('../task-names');

/*
 * Marks a deployment as completed, or deletes it if it didn't produce any changes.
 * */
subtask(SUBTASK_FINALIZE_DEPLOYMENT).setAction(async (_, hre) => {
  logger.subtitle('Finalizing deployment');

  if (hre.router.deployment.general.properties.totalGasUsed === '0') {
    logger.checked('Deployment did not produce any changes, deleting temp files');

    const toDelete = [hre.router.paths.deployment, hre.router.paths.sources, hre.router.paths.abis];

    await del(toDelete);
  } else {
    logger.complete('Deployment marked as completed');

    hre.router.deployment.general.properties.completed = true;
  }
});
