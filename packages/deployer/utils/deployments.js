const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const { defaults } = require('../extensions/config');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

function getMainProxyAddress({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
} = {}) {
  const data = getCurrentDeploymentDataForInstance({ network, instance, deploymentsFolder });

  // TODO: This should just be "MainProxy" after
  // we remove the ability to rename it('', async () => {}.);
  const key = Object.keys(data.contracts).find((id) => id.includes('Proxy'));

  return data.contracts[key].deployedAddress;
}

function getCurrentDeploymentDataForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
} = {}) {
  const file = getCurrentDeploymentFileForInstance({ network, instance, deploymentsFolder });

  if (!file) {
    throw new Error(`No deployment file found on "${deploymentsFolder}".`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getCurrentDeploymentFileForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
} = {}) {
  const deployments = getAllDeploymentsFilesForInstance({ network, instance, deploymentsFolder });

  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

function getAllDeploymentsFilesForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
} = {}) {
  const instanceFolder = getDeploymentFolderForInstance({ network, instance, deploymentsFolder });

  return glob
    .sync(`${instanceFolder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

function getDeploymentFolderForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
} = {}) {
  return path.join(deploymentsFolder, network, instance);
}

module.exports = {
  getAllDeploymentsFilesForInstance,
  getCurrentDeploymentFileForInstance,
  getCurrentDeploymentDataForInstance,
  getMainProxyAddress,
};
