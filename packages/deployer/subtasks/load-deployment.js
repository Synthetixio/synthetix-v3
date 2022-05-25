const fs = require('fs');
const { subtask } = require('hardhat/config');

const {
  getAllDeploymentFiles,
  getDeploymentExtendedFiles,
} = require('@synthetixio/deployer/utils/deployments');
const { SUBTASK_LOAD_DEPLOYMENT } = require('../task-names');
const autosaveObject = require('../internal/autosave-object');

subtask(SUBTASK_LOAD_DEPLOYMENT, 'Loads deployment artifacts for a particular instance').setAction(
  async (taskArguments, hre) => {
    const { readOnly, instance } = taskArguments;

    const info = {
      folder: hre.config.deployer.paths.deployments,
      network: hre.network.name,
      instance,
    };

    const deploymentFiles = getAllDeploymentFiles(info);

    const currentDeploymentFile =
      deploymentFiles.length > 0 ? deploymentFiles[deploymentFiles.length - 1] : null;
    const previousDeploymentFile =
      deploymentFiles.length > 1 ? deploymentFiles[deploymentFiles.length - 2] : null;

    const { sources, abis } = getDeploymentExtendedFiles(currentDeploymentFile);

    hre.deployer.paths.deployment = currentDeploymentFile;
    hre.deployer.paths.sources = sources;
    hre.deployer.paths.abis = abis;

    hre.deployer.deployment = {
      general: readOnly
        ? JSON.parse(fs.readFileSync(currentDeploymentFile))
        : autosaveObject(currentDeploymentFile),
      sources: readOnly ? JSON.parse(fs.readFileSync(sources)) : autosaveObject(sources, {}),
      abis: readOnly ? JSON.parse(fs.readFileSync(abis)) : autosaveObject(abis, {}),
    };

    if (previousDeploymentFile) {
      const { sources: previousSources } = getDeploymentExtendedFiles(previousDeploymentFile);
      hre.deployer.previousDeployment = {
        general: JSON.parse(fs.readFileSync(previousDeploymentFile)),
        sources: JSON.parse(fs.readFileSync(previousSources)),
      };
    }
  }
);
