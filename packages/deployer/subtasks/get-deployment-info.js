const { subtask } = require('hardhat/config');
const { SUBTASK_GET_DEPLOYMENT_INFO } = require('../task-names');

const {
  getAllDeploymentFiles,
  getDeploymentExtendedFiles,
} = require('@synthetixio/deployer/utils/deployments');

const fs = require('fs');

subtask(
  SUBTASK_GET_DEPLOYMENT_INFO,
  'Get the deployment info of the current instance',
  async ({ instance }, hre) => {
    // deployer leaves its result in JSON files. We only care about the current and "extension"
    const [currentDeploymentFile] = getAllDeploymentFiles({ network: hre.network.name, instance });
    const extendedFile = getDeploymentExtendedFiles(currentDeploymentFile);

    const info = JSON.parse(fs.readFileSync(currentDeploymentFile));
    const abis = JSON.parse(fs.readFileSync(extendedFile.abis));

    return {
      info,
      abis,
    };
  }
);
