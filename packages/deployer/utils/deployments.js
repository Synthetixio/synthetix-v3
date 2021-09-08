const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const relativePath = require('./relative-path');
const { capitalize } = require('./string');

// Regex for deployment file formats, e.g.: 2021-08-31-00-sirius.json
const DEPLOYMENT_FILE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2,}(?:-[a-z0-9]+)?\.json$/;

function getMainProxyAddress(instance = 'official') {
  const data = getDeploymentData(instance);

  return data.contracts['contracts/MainProxy.sol'].deployedAddress;
}

function getDeploymentData(instance = 'official') {
  const file = getDeploymentFile(instance);

  if (!file) {
    throw new Error(
      `No deployment file found on network "${hre.network.name}" for instance "${instance}".`
    );
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getDeploymentFile(instance = 'official') {
  const deployments = getDeploymentFiles(instance);

  return deployments.length > 0 ? deployments[deployments.length - 1] : null;
}

function getDeploymentFiles(instance = 'official') {
  const paths = getDeploymentPaths(instance);
  const folder = paths.instance;

  return glob
    .sync(`${folder}/*.json`)
    .filter((file) => DEPLOYMENT_FILE_FORMAT.test(path.basename(file)))
    .sort(naturalCompare);
}

function getProxyPath(config) {
  return relativePath(path.join(config.paths.sources, `${config.deployer.proxyName}.sol`));
}

function getDeploymentPaths(config, { network = 'local', instance = 'official' }) {
  const paths = {};

  paths.network = path.join(config.deployer.paths.deployments, network);
  paths.instance = path.join(paths.network, instance);
  paths.extended = path.join(paths.instance, 'extended');

  const routerModule = ['GenRouter', network, instance].map(capitalize).join('');
  paths.routerPath = relativePath(path.join(config.paths.sources, `${routerModule}.sol`));

  return paths;
}

module.exports = {
  getMainProxyAddress,
  getDeploymentFile,
  getDeploymentFiles,
  getDeploymentData,
  getDeploymentPaths,
  getProxyPath,
};
