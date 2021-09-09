const path = require('path');
const { extendConfig } = require('hardhat/config');

const DEFAULTS = {
  paths: {
    modules: 'contracts/modules',
    deployments: 'deployments',
  },
};

extendConfig((config, userConfig) => {
  const { root } = config.paths;
  const { deployer: givenConfig = {} } = userConfig;

  // Resolve the absolute path from the root of the configurable path
  function resolvePath(key) {
    return path.resolve(root, givenConfig?.paths?.[key] || DEFAULTS.paths[key]);
  }

  config.deployer = {
    ...DEFAULTS,
    ...givenConfig,
    paths: {
      ...DEFAULTS.paths,
      modules: resolvePath('modules'),
      deployments: resolvePath('deployments'),
    },
  };
});

module.exports = {
  defaults: DEFAULTS,
};
