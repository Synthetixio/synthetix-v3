const path = require('path');
const { extendEnvironment } = require('hardhat/config');

extendEnvironment((hre) => {
  if (hre.router) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.router = {
    paths: {
      routerTemplate: path.resolve(__dirname, '../templates/Router.sol.mustache'),
      deployment: null,
      sources: null,
      abis: null,
      cache: null,
    },
    deployment: null,
    previousDeployment: null,
  };

  // Prevent any properties being added to hre.router
  // other than those defined above.
  Object.preventExtensions(hre.router);
  Object.preventExtensions(hre.router.paths);
});
