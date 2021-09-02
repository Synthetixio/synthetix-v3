const fs = require('fs');
const path = require('path');
const glob = require('glob');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const { subtask } = require('hardhat/config');

const logger = require('../utils/logger');
const prompter = require('../utils/prompter');
const relativePath = require('../utils/relative-path');
const autosaveObject = require('../utils/autosave-object');
const { SUBTASK_PREPARE_DEPLOYMENT } = require('../task-names');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

const DEPLOYMENT_SCHEMA = {
  properties: {
    completed: false,
    totalGasUsed: 0,
  },
  transactions: {},
  contracts: {
    modules: {},
  },
};

subtask(
  SUBTASK_PREPARE_DEPLOYMENT,
  'Prepares the deployment file associated with the active deployment.'
).setAction(async (taskArguments, hre) => {
  const { clear, alias } = taskArguments;

  if (clear) {
    await _clearDeploymentData(hre.deployer.paths.instance);
  }

  mkdirp.sync(hre.deployer.paths.instance);

  hre.deployer.file = await _determineDeploymentFile(hre.deployer.paths.instance, alias);
  hre.deployer.data = autosaveObject(hre.deployer.file, DEPLOYMENT_SCHEMA);
});

/**
 * Delete the given folder, optionally prompting the user
 * @param {string} folder
 */
async function _clearDeploymentData(folder) {
  logger.warn(
    'Received --clear parameter. This will delete all previous deployment data on the given instance!'
  );
  await prompter.confirmAction(`Clear all data on ${folder}`);
  rimraf.sync(folder);
}

/**
 * Initialize a new deployment file, or, if existant, try to continue using it.
 * @param {string} folder deployment folder where to find files
 * @param {string} [alias]
 * @returns {string} path to deployment file
 */
async function _determineDeploymentFile(folder, alias) {
  const deployments = glob
    .sync(`${folder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)));

  // Check if there is an unfinished deployment and prompt the user if we should
  // continue with it, instead of creating a new one.
  for (const file of deployments) {
    const data = JSON.parse(fs.readFileSync(file));

    if (!data.properties.completed) {
      const use = await prompter.ask(
        `Do you wish to continue the unfinished deployment "${relativePath(file)}"?`
      );

      if (use) {
        return file;
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

  // Calculate the next deployment number
  let number = '00';
  const fromToday = deployments.filter((file) => path.basename(file).startsWith(`${today}-`));
  if (fromToday.length > 0) {
    const [last] = fromToday
      .map((file) => Number.parseInt(path.basename(file).slice(11, 13)))
      .sort((a, b) => b - a);
    number = `${last + 1}`.padStart(2, '0');
  }

  const file = `${today}-${number}${alias ? `-${alias}` : ''}.json`;

  return path.join(folder, file);
}

function _getDate() {
  const now = new Date();
  const year = `${now.getUTCFullYear()}`;
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${now.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
