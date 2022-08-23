const path = require('path');
const { extendConfig } = require('hardhat/config');
const configDefaults = require('../internal/config-defaults');

extendConfig((config, userConfig) => {
  const { root, sources } = config.paths;
  const { router: givenConfig = {} } = userConfig;

  config.router = {
    ...configDefaults,
    ...givenConfig,
    paths: {
      ...configDefaults.paths,
      ...(givenConfig?.paths || {}),
    },
  };

  // Resolve the absolute path from the root of the configurable path
  config.router.paths.deployments = path.resolve(root, config.router.paths.deployments);
  config.router.paths.modules = path.resolve(sources, config.router.paths.modules);
  config.router.paths.cache = path.resolve(root, config.router.paths.cache);
});
