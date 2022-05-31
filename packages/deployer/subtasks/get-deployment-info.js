const { subtask } = require('hardhat/config');
const { SUBTASK_GET_DEPLOYMENT_INFO } = require('../task-names');

subtask(
  SUBTASK_GET_DEPLOYMENT_INFO,
  'Get the deployment info of the current instance',
  async ({ instance }, hre) => {
    if (!instance) throw new Error('"instance" param is required');

    return {
      folder: hre.config.deployer.paths.deployments,
      network: hre.network.name,
      instance,
    };
  }
);
