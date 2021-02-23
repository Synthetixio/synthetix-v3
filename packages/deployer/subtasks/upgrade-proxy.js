const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { SUBTASK_UPGRADE_PROXY, SUBTASK_DEPLOY_CONTRACTS } = require('../task-names');

/*
 * Checks if the main proxy needs to be deployed,
 * and upgrades it if needed.
 * */
subtask(SUBTASK_UPGRADE_PROXY).setAction(async (_, hre) => {
  logger.subtitle('Upgrading main proxy');

  const data = readDeploymentFile({ hre });

  const implementationAddress = [data[`Router_${hre.network.name}`].deployedAddress];
  logger.info(`Target implementation: ${implementationAddress}`);

  await hre.run(SUBTASK_DEPLOY_CONTRACTS, {
    contractNames: [hre.config.deployer.proxyName],
    force: false,
    constructorArgs: [implementationAddress],
  });
});
