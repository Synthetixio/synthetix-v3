const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');

const { SUBTASK_DEPLOY_CONTRACTS, SUBTASK_DEPLOY_MODULES } = require('../task-names');

subtask(SUBTASK_DEPLOY_MODULES).setAction(async (_, hre) => {
  logger.subtitle('Deploying modules');

  await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contracts: hre.deployer.data.contracts.modules,
  });
});
