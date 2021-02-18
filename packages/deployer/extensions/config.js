const { extendConfig } = require('hardhat/config');

extendConfig((runtimeConfig, userConfig) => {
  const config = userConfig.deployer;

  if (!config) {
    throw new Error('Deployer plugin config not found in hardhat.config.js');
  }

  runtimeConfig.deployer = config;
});
