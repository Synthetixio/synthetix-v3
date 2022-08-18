const path = require('path');
const { extendConfig } = require('hardhat/config');
const configDefaults = require('../internal/config-defaults');

extendConfig((config, userConfig) => {
  const { root, sources } = config.paths;
  const { deployer: givenConfig = {} } = userConfig;

  config.deployer = {
    ...configDefaults,
    ...givenConfig,
    paths: {
      ...configDefaults.paths,
      ...(givenConfig?.paths || {}),
    },
  };

  // Resolve the absolute path from the root of the configurable path
  config.deployer.paths.deployments = path.resolve(root, config.deployer.paths.deployments);
  config.deployer.paths.modules = path.resolve(sources, config.deployer.paths.modules);
});
