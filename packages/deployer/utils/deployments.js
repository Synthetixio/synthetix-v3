const fs = require('fs');
const path = require('path');
const glob = require('glob');
const naturalCompare = require('string-natural-compare');
const relativePath = require('./relative-path');

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

function getDeploymentPaths(instance = 'official') {
  const paths = {};

  paths.deployments = path.resolve(hre.config.paths.root, hre.config.deployer.paths.deployments);
  paths.modules = path.resolve(hre.config.paths.root, hre.config.deployer.paths.modules);
  paths.network = path.join(paths.deployments, hre.network.name);
  paths.instance = path.join(paths.network, instance);
  paths.extended = path.join(paths.instance, 'extended');
  paths.routerTemplate = path.resolve(__dirname, '../templates/GenRouter.sol.mustache');
  paths.routerPath = relativePath(
    path.join(hre.config.paths.sources, `${hre.deployer.routerModule}.sol`)
  );
  paths.proxyPath = relativePath(
    path.join(hre.config.paths.sources, `${hre.config.deployer.proxyName}.sol`)
  );
  paths.mixins = path.resolve(hre.config.paths.root, hre.config.deployer.paths.mixins);
  paths.imcMixinTemplate = path.resolve(__dirname, '../templates/GenIMCMixin.sol.mustache');
  paths.imcMixinPath = path.join(paths.mixins, `${hre.deployer.imcMixinModule}.sol`);

  return paths;
}

module.exports = {
  getMainProxyAddress,
  getDeploymentFile,
  getDeploymentFiles,
  getDeploymentData,
  getDeploymentPaths,
};
