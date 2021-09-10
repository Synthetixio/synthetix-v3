const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const { subtask } = require('hardhat/config');

const prompter = require('@synthetixio/core-js/utils/prompter');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const autosaveObject = require('../internal/autosave-object');
const { getAllDeploymentsFilesForInstance } = require('../utils/deployments');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

const DEPLOYMENT_SCHEMA = {
  properties: {
    completed: false,
    totalGasUsed: '0',
  },
  transactions: {},
  contracts: {},
  file: null,
};

subtask(
  SUBTASK_PREPARE_DEPLOYMENT,
  'Prepares the deployment file associated with the active deployment.'
).setAction(async (taskArguments, hre) => {
  const { instance, alias } = taskArguments;

  const deploymentsFolder = path.join(
    hre.config.deployer.paths.deployments,
    hre.network.name,
    instance
  );

  // Make sure the deployments folder exists
  mkdirp.sync(deploymentsFolder);

  const { previousFile, currentFile } = await _determineDeploymentFiles(deploymentsFolder, alias);

  hre.deployer.deployment = autosaveObject(currentFile, DEPLOYMENT_SCHEMA);
  hre.deployer.deployment.file = relativePath(currentFile);

  if (previousFile) {
    hre.deployer.previousDeployment = JSON.parse(fs.readFileSync(previousFile));
  }
});

/**
 * Initialize a new deployment file, or, if existant, try to continue using it.
 * @param {string} folder deployment folder where to find files
 * @param {string} [alias]
 * @returns {{ currentFile: string, previousFile: string }}
 */
async function _determineDeploymentFiles(deploymentsFolder, alias) {
  const deployments = getAllDeploymentsFilesForInstance(deploymentsFolder);
  const latestFile = deployments.length > 0 ? deployments[deployments.length - 1] : null;

  // Check if there is an unfinished deployment and prompt the user if we should
  // continue with it, instead of creating a new one.
  if (latestFile) {
    const latestData = JSON.parse(fs.readFileSync(latestFile));

    if (!latestData.properties.completed) {
      const use = await prompter.ask(
        `Do you wish to continue the unfinished deployment "${relativePath(latestFile)}"?`
      );

      if (use) {
        return {
          currentFile: latestFile,
          previousFile: deployments.length > 1 ? deployments[deployments.length - 2] : null,
        };
      }
    }
  }

  // Check that the given alias is available
  if (alias) {
    const file = deployments.find((file) => file.endsWith(`-${alias}.json`));
    if (file) {
      throw new Error(
        `The alias "${alias}" is already used by the deployment "${relativePath(file)}"`
      );
    }
  }

  // Get the date with format `YYYY-mm-dd`
  const today = _getDate();

  // Calculate the next deployment number based on the previous one
  let number = '00';
  if (latestFile && path.basename(latestFile).startsWith(today)) {
    const previousNumber = path.basename(latestFile).slice(11, 13);
    number = `${Number.parseInt(previousNumber) + 1}`.padStart(2, '0');
  }

  const currentFile = path.join(
    deploymentsFolder,
    `${today}-${number}${alias ? `-${alias}` : ''}.json`
  );

  return {
    previousFile: latestFile,
    currentFile,
  };
}

function _getDate() {
  const now = new Date();
  const year = `${now.getUTCFullYear()}`;
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${now.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
