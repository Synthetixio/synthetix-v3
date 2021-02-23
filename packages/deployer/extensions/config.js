const { extendConfig } = require('hardhat/config');

extendConfig((runtimeConfig, userConfig) => {
  const config = userConfig.deployer;

  if (!config) {
    throw new Error('Deployer plugin config not found in hardhat.config.js');
  }

  if (!config.paths) {
    config.paths = {};
  }

  if (!config.paths.modules) {
    config.paths.modules = 'contracts/modules';
  }

  if (!config.paths.modules) {
    config.paths.deployments = 'deployments';
  }

  if (!config.proxyName) {
    throw new Error(
      'Please specify a "deployer.proxyName" in your hardhat configuration file. This is the main entry point of the system, and should be a proxy that forwards calls to an implementation that has an `upgradeTo` function.'
    );
  }

  runtimeConfig.deployer = config;
});
