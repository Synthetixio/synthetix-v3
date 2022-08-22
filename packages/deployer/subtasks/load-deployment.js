const fs = require('fs');
const { subtask } = require('hardhat/config');

const { getAllDeploymentFiles, getDeploymentExtendedFiles } = require('../utils/deployments');
const autosaveObject = require('../internal/autosave-object');
const { SUBTASK_LOAD_DEPLOYMENT, SUBTASK_GET_DEPLOYMENT_INFO } = require('../task-names');

subtask(SUBTASK_LOAD_DEPLOYMENT, 'Loads deployment artifacts for a particular instance').setAction(
  async ({ readOnly, instance }, hre) => {
    const info = await hre.run(SUBTASK_GET_DEPLOYMENT_INFO, { instance });

    const deploymentFiles = getAllDeploymentFiles(info);

    const currentDeploymentFile =
      deploymentFiles.length > 0 ? deploymentFiles[deploymentFiles.length - 1] : null;
    const previousDeploymentFile =
      deploymentFiles.length > 1 ? deploymentFiles[deploymentFiles.length - 2] : null;

    const { sources, abis } = getDeploymentExtendedFiles(currentDeploymentFile);

    hre.deployer.paths.deployment = currentDeploymentFile;
    hre.deployer.paths.sources = sources;
    hre.deployer.paths.abis = abis;
    hre.deployer.paths.cache = hre.config.deployer.paths.cache;

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
