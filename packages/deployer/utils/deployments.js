const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const { defaults } = require('../extensions/config');

/**
 * @typedef {Object} DeploymentInfo An object describing which deployment to retrieve
 * @property {string} network The network of the target deployment
 * @property {string} instance The instance name of the target deployment
 * @property {string} folder The path to the folder where deployment files are stored
 */
const DeploymentInfo = {
  network: 'local',
  instance: 'official',
  folder: defaults.paths.deployments,
};

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_NAME_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?$/;

function _isValidDeploymentName(name) {
  return DEPLOYMENT_NAME_FORMAT.test(name);
}

/**
 * Get the paths to the extended files for a given deployment
 * @param {string} file location of the deployment file
 */
function getDeploymentExtendedFiles(file) {
  const folder = path.dirname(file);
  const name = path.basename(file, '.json');

  return {
    sources: path.resolve(folder, 'extended', `${name}.sources.json`),
    abis: path.resolve(folder, 'extended', `${name}.abis.json`),
    txs: path.resolve(folder, 'extended', `${name}.txs.json`),
  };
}

/**
 * Retrieves the address of the target instance's deployed proxy
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {address} The address of the proxy
 */
function getProxyAddress(info) {
  info = _populateDefaults(info);

  const deployment = getDeployment(info);

  return deployment.contracts.Proxy.deployedAddress;
}

/**
 * Retrieves the address of the target instance's deployed router
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {address} The address of the router
 */
function getRouterAddress(info) {
  info = _populateDefaults(info);

  const deployment = getDeployment(info);

  return deployment.contracts.Router.deployedAddress;
}

/**
 * Retrieves an object with the latest deployment json data for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {Object} An object with deployment schema
 */
function getDeployment(info) {
  info = _populateDefaults(info);

  const file = getDeploymentFile(info);

  if (!file) {
    return null;
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Retrieves the file with the latest deployment data for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {string} The path of the file
 */
function getDeploymentFile(info) {
  info = _populateDefaults(info);

  const deployments = getAllDeploymentFiles(info);

  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

/**
 * Retrieves all deployment files for an instance, including past deployments
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {array} An array of paths for the files
 */
function getAllDeploymentFiles(info) {
  info = _populateDefaults(info);

  const instanceFolder = getDeploymentFolder(info);

  return glob
    .sync(`${instanceFolder}/*.json`)
    .filter((file) => _isValidDeploymentName(getDeploymentName(file)))
    .sort(naturalCompare);
}

/**
 * Retrieves the deployemnt folder path for an instance
 * @param {DeploymentInfo} info See DeploymentInfo above
 * @returns {string} The path of the folder
 */
function getDeploymentFolder(info) {
  info = _populateDefaults(info);

  return path.join(info.folder, info.network, info.instance);
}

function _populateDefaults(info) {
  return { ...info, ...DeploymentInfo };
}

module.exports = {
  getDeploymentExtendedFiles,
  getProxyAddress,
  getRouterAddress,
  getDeployment,
  getDeploymentFile,
  getAllDeploymentFiles,
  getDeploymentFolder,
};
