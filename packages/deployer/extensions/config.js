const path = require('path');
const { extendConfig } = require('hardhat/config');
const configDefaults = require('../internal/config-defaults');

extendConfig((config, userConfig) => {
  const { root } = config.paths;
  const { deployer: givenConfig = {} } = userConfig;

  // Resolve the absolute path from the root of the configurable path
  function resolvePath(key) {
    return path.resolve(root, givenConfig?.paths?.[key] || configDefaults.paths[key]);
  }

  config.deployer = {
    ...configDefaults,
    ...givenConfig,
    paths: {
      ...configDefaults.paths,
      modules: resolvePath('modules'),
      deployments: resolvePath('deployments'),
    },
  };
});
