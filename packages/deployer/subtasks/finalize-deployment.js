const fs = require('fs');
const logger = require('@synthetixio/core-js/utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_FINALIZE_DEPLOYMENT } = require('../task-names');

/*
 * Marks a deployment as completed, or deletes it if it didn't produce any changes.
 * */
subtask(SUBTASK_FINALIZE_DEPLOYMENT).setAction(async (_, hre) => {
  logger.subtitle('Finalizing deployment');

  if (hre.deployer.data.properties.totalGasUsed === '0') {
    logger.checked('Deployment did not produce any changes, deleting temp file');

    fs.unlinkSync(hre.deployer.file);
  } else {
    logger.complete('Deployment marked as completed');

    hre.deployer.data.properties.completed = true;
  }
});
