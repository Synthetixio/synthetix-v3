const path = require('path');
const { extendConfig } = require('hardhat/config');

const DEFAULTS = {
  proxyName: 'MainProxy',
  routerTemplate: path.resolve(__dirname, '../templates/GenRouter.sol.mustache'),
  paths: {
    modules: 'contracts/modules',
    deployments: 'deployments',
  },
};

extendConfig((config, userConfig) => {
  const { root } = config.paths;
  const { deployer: givenConfig = {} } = userConfig;

  config.deployer = {
    ...DEFAULTS,
    ...givenConfig,
    paths: {
      ...DEFAULTS.paths,
      modules: path.resolve(root, givenConfig.paths.modules || DEFAULTS.paths.modules),
      deployments: path.resolve(root, givenConfig.paths.deployments || DEFAULTS.paths.deployments),
    },
  };
});
