const fs = require('fs');
const path = require('path');
const { extendConfig, extendEnvironment } = require('hardhat/config');

extendConfig((config, userConfig) => {
  if (!userConfig.deployer) {
    throw new Error('Deployer plugin config not found in hardhat.config.js');
  }

  if (!userConfig.deployer.proxyName) {
    throw new Error(
      'Please specify a "deployer.proxyName" in your hardhat configuration file. This is the main entry point of the system, and should be a proxy that forwards calls to an implementation that has an `upgradeTo` function.'
    );
  }

  config.deployer = {
    proxyName: '',
    paths: {
      modules: 'contracts/modules',
      deployments: 'deployments',
      ...(userConfig.deployer.paths || {}),
    },
    ...userConfig.deployer,
  };
});

extendEnvironment((hre) => {
  if (hre.deployer) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.deployer = {
    paths: {},
  };
});

['tasks', 'subtasks'].forEach((folder) =>
  fs
    .readdirSync(path.join(__dirname, folder))
    .forEach((mod) => require(path.join(__dirname, folder, mod)))
);
