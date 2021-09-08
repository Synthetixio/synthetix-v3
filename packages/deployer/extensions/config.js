const path = require('path');
const { extendConfig } = require('hardhat/config');

const DEFAULTS = {
  proxyName: 'MainProxy',
  paths: {
    routerTemplate: path.resolve(__dirname, '../templates/GenRouter.sol.mustache'),
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
      routerTemplate: resolvePath('routerTemplate'),
      modules: resolvePath('modules'),
      deployments: resolvePath('deployments'),
    },
  };
});
