const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const relativePath = require('@synthetixio/core-js/utils/relative-path');
const { getRouterName } = require('./router');
const { startsWithWord } = require('@synthetixio/core-js/utils/string');
const { defaults } = require('../extensions/config');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

function getMainProxyAddress({ network = 'local', instance = 'official' } = {}) {
  const paths = getDeploymentPaths({ network, instance });
  const data = getDeploymentData(paths.deployments);
  return data.contracts[getProxyPath(config)].deployedAddress;
}

// function getDeploymentData(deploymentsFolder) {
//   const file = getDeploymentFile(deploymentsFolder);

//   if (!file) {
//     throw new Error(`No deployment file found on "${deploymentsFolder}".`);
//   }

//   return JSON.parse(fs.readFileSync(file, 'utf8'));
// }

// function getDeploymentFile(deploymentsFolder) {
//   const deployments = getDeploymentFiles(deploymentsFolder);
//   return deployments.length > 0 ? deployments[deployments.length - 1] : null;
// }

// function getDeploymentFiles(deploymentsFolder) {
//   return glob
//     .sync(`${deploymentsFolder}/*.json`)
//     .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
//     .sort(naturalCompare);
// }

function getModulesPaths(config) {
  return glob
    .sync(path.join(config.deployer.paths.modules, '**/*.sol'))
    .map((source) => relativePath(source, hre.config.paths.root));
}

function getProxyPath(config) {
  return relativePath(
    path.join(config.paths.sources, `${config.deployer.proxyName}.sol`),
    config.paths.root
  );
}

// function getDeploymentPaths({
//   network = 'local',
//   instance = 'official',
//   folder = defaults.paths.deployments,
//   sources = 'contracts',
// } = {}) {
//   return {
//     deployments: path.join(folder, network, instance),
//     router: path.join(sources, `${getRouterName({ network, instance })}.sol`),
//   };
// }

function getCurrentDeploymentDataForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
}) {
  const file = getCurrentDeploymentFileForInstance(deploymentsFolder);

  if (!file) {
    throw new Error(`No deployment file found on "${deploymentsFolder}".`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getCurrentDeploymentFileForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
}) {
  const deployments = getAllDeploymentsFilesForInstance(deploymentsFolder);

  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

function getAllDeploymentsFilesForInstance(
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
) {
  const instanceFolder = getDeploymentFolderForInstance({ network, instance, deploymentsFolder });

  return glob
    .sync(`${deploymentsFolder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

function getDeploymentFolderForInstance({
  network = 'local',
  instance = 'official',
  deploymentsFolder = defaults.paths.deployments,
}) {
  return path.join(deploymentsFolder, network, instance);
}

module.exports = {
  getMainProxyAddress,
  getDeploymentFile,
  getDeploymentFiles,
  getDeploymentData,
  getDeploymentPaths,
  getModulesPaths,
  getProxyPath,
};
