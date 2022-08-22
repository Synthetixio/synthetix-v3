const { subtask } = require('hardhat/config');
const { SUBTASK_GET_DEPLOYMENT_INFO } = require('../task-names');

const {
  getAllDeploymentFiles,
  getDeploymentExtendedFiles,
} = require('@synthetixio/hardhat-router/utils/deployments');

const fs = require('fs');

subtask(
  SUBTASK_GET_DEPLOYMENT_INFO,
  'Get the deployment info of the current instance',
  async ({ instance }, hre) => {
    if (!instance) throw new Error('"instance" param is required');

    // hardhat-router leaves its result in JSON files,
    // we only care about the current and "extension".
    const [currentDeploymentFile] = getAllDeploymentFiles({ network: hre.network.name, instance });
    const extendedFile = getDeploymentExtendedFiles(currentDeploymentFile);

    let info = {};
    let abis = null;

    if (fs.existsSync(extendedFile.abis)) {
      info = JSON.parse(fs.readFileSync(currentDeploymentFile));
      abis = JSON.parse(fs.readFileSync(extendedFile.abis));
    }

    return {
      folder: hre.config.router.paths.deployments,
      network: hre.network.name,
      instance,
      info,
      abis,
    };
  }
);
