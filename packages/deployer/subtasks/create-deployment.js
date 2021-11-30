const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const { subtask } = require('hardhat/config');

const prompter = require('@synthetixio/core-js/utils/prompter');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const getDate = require('@synthetixio/core-js/utils/get-date');
const { getDeploymentFolder, getAllDeploymentFiles } = require('../utils/deployments');
const { SUBTASK_CREATE_DEPLOYMENT } = require('../task-names');

const DEPLOYMENT_SCHEMA = {
  properties: {
    completed: false,
    totalGasUsed: '0',
  },
  transactions: {},
  contracts: {},
};

subtask(SUBTASK_CREATE_DEPLOYMENT, 'Creates the necessary deployment files, if needed').setAction(
  async (taskArguments, hre) => {
    const { instance, alias } = taskArguments;

    const info = {
      folder: hre.config.deployer.paths.deployments,
      network: hre.network.name,
      instance,
    };

    const deploymentsFolder = getDeploymentFolder(info);
    const deploymentFiles = getAllDeploymentFiles(info);

    await _createFoldersIfNeeded([deploymentsFolder, path.join(deploymentsFolder, 'extended')]);

    await _createNewDeploymentFileIfNeeded({ deploymentFiles, deploymentsFolder, alias });
  }
);

async function _createFoldersIfNeeded(folders) {
  for (let folder of folders) {
    await mkdirp(folder);
  }
}

async function _createNewDeploymentFileIfNeeded({ deploymentFiles, deploymentsFolder, alias }) {
  const latestFile =
    deploymentFiles.length > 0 ? deploymentFiles[deploymentFiles.length - 1] : null;

  // Check if there is an unfinished deployment and prompt the user if we should
  // continue with it, instead of creating a new one.
  if (latestFile) {
    const latestData = JSON.parse(fs.readFileSync(latestFile));

    if (!latestData.properties.completed) {
      const continueUnfinishedDeployment = await prompter.ask(
        `Found an unfinished deployment at "${relativePath(
          latestFile
        )}". Do you wish to continue using this deployment?\nChoose "no" to ignore this deployment and create a new one from scratch.`
      );

      if (continueUnfinishedDeployment) {
        return;
      }
    }
  }

  // Check that the given alias is available
  if (alias) {
    const exists = deploymentFiles.some((file) => file.endsWith(`-${alias}.json`));
    if (exists) {
      throw new Error(
        `The alias "${alias}" is already used by the deployment "${relativePath(exists)}"`
      );
    }
  }

  // Get the date with format `YYYY-mm-dd`
  const today = getDate();

  // Calculate the next deployment number based on the previous one
  let number = '00';
  const latestFileName = latestFile && path.basename(latestFile);
  if (latestFileName && latestFileName.startsWith(today)) {
    const previousNumber = latestFileName.slice(11, 13);
    number = `${Number.parseInt(previousNumber) + 1}`.padStart(2, '0');
  }

  const newFileName = `${today}-${number}${alias ? `-${alias}` : ''}`;
  const newFile = path.join(deploymentsFolder, `${newFileName}.json`);

  fs.writeFileSync(newFile, JSON.stringify(DEPLOYMENT_SCHEMA, null, 2));
}
