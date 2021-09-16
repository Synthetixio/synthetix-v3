const path = require('path');
const { extendEnvironment } = require('hardhat/config');

extendEnvironment((hre) => {
  if (hre.deployer) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.deployer = {
    paths: {
      routerTemplate: path.resolve(__dirname, '../templates/Router.sol.mustache'),
      deployment: null,
      sources: null,
      abis: null,
    },
    deployment: null,
    previousDeployment: null,
  };

  // Prevent any properties being added to hre.deployer
  // other than those defined above.
  Object.preventExtensions(hre.deployer);
  Object.preventExtensions(hre.deployer.paths);
});
