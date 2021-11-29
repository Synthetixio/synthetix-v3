const fs = require('fs');
const { subtask } = require('hardhat/config');

const {
  getDeploymentFolder,
  getAllDeploymentFiles,
  getDeploymentExtendedFiles,
} = require('@synthetixio/deployer/utils/deployments');
const { SUBTASK_LOAD_DEPLOYMENT } = require('../task-names');

subtask(SUBTASK_LOAD_DEPLOYMENT, 'Loads deployment artifacts for a particular instance').setAction(
  async (taskArguments, hre) => {
    const { instance } = taskArguments;

    const info = {
      folder: hre.config.deployer.paths.deployments,
      network: hre.network.name,
      instance,
    };

    const deploymentsFolder = getDeploymentFolder(info);
    if (!fs.existsSync(deploymentsFolder)) {
      throw new Error(`Deployment folder ${deploymentsFolder} does not exist`);
    }

    const deployments = getAllDeploymentFiles(info);
    const currentFile = deployments.length > 0 ? deployments[deployments.length - 1] : null;

    const { sources, abis } = getDeploymentExtendedFiles(currentFile);

    hre.deployer.paths.deployment = currentFile;
    hre.deployer.paths.sources = sources;
    hre.deployer.paths.abis = abis;

    hre.deployer.deployment = {
      general: currentFile,
      sources,
      abis,
    };
  }
);
