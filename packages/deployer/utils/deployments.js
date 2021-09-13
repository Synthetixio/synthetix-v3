const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const { defaults } = require('../extensions/config');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

/**
 * @param {Object} info An object describing which deployment to retrieve
 * @param {string} info.network The network of the target deployment
 * @param {string} info.instance The instance name of the target deployment
 * @param {string} info.folder The path to the folder where deployment files are stored
 */
const DeploymentInfo = {
  network: 'local',
  instance: 'official',
  folder: defaults.paths.deployments,
};

/**
 * Retrieves the address of the target instance's deployed proxy
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {address} The address of the proxy
 */
function getProxyAddress(info = DeploymentInfo) {
  const deployment = getDeployment(info);

  return deployment.contracts.Proxy.deployedAddress;
}

/**
 * Retrieves an object with the latest deployment json data for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {Object} An object with deployment schema
 */
function getDeployment(info = DeploymentInfo) {
  const file = getDeploymentFile(info);

  if (!file) {
    throw new Error(`No deployment file found on "${info.folder}".`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Retrieves the file with the latest deployment data for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {string} The path of the file
 */
function getDeploymentFile(info = DeploymentInfo) {
  const deployments = getAllDeploymentFiles(info);

  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

/**
 * Retrieves all deployment files for an instance, including past deployments
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {array} An array of paths for the files
 */
function getAllDeploymentFiles(info = DeploymentInfo) {
  const instanceFolder = getDeploymentFolder(info);

  return glob
    .sync(`${instanceFolder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

/**
 * Retrieves the deployemnt folder path for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {string} The path of the folder
 */
function getDeploymentFolder(info = DeploymentInfo) {
  return path.join(info.folder, info.network, info.instance);
}

module.exports = {
  getProxyAddress,
  getDeployment,
  getDeploymentFile,
  getAllDeploymentFiles,
  getDeploymentFolder,
};
