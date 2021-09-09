const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const relativePath = require('@synthetixio/core-js//utils/relative-path');
const { getRouterName } = require('router');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

function getMainProxyAddress(config, { network = 'local', instance = 'official' } = {}) {
  const paths = getDeploymentPaths(config, { network, instance });
  const data = getDeploymentData(paths.deployments);
  return data.contracts[getProxyPath(config)].deployedAddress;
}

function getDeploymentData(deploymentsFolder) {
  const file = getDeploymentFile(deploymentsFolder);

  if (!file) {
    throw new Error(`No deployment file found on "${deploymentsFolder}".`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getDeploymentFile(deploymentsFolder) {
  const deployments = getDeploymentFiles(deploymentsFolder);
  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

function getDeploymentFiles(deploymentsFolder) {
  return glob
    .sync(`${deploymentsFolder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

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

function getDeploymentPaths(config, { network = 'local', instance = 'official' } = {}) {
  return {
    deployments: path.join(config.deployer.paths.deployments, network, instance),
    router: relativePath(
      path.join(config.paths.sources, `${getRouterName({ network, instance })}.sol`),
      config.paths.root
    ),
  };
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
