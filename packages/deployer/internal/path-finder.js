const path = require('path');
const glob = require('glob');
const relativePath = require('@synthetixio/core-js/utils/relative-path');

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

module.exports = {
  getModulesPaths,
  getProxyPath,
};
