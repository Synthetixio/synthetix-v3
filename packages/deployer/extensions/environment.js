const path = require('path');
const { extendEnvironment } = require('hardhat/config');

extendEnvironment((hre) => {
  if (hre.deployer) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.deployer = {
    paths: {
      routerTemplate: path.resolve(__dirname, '../templates/Router.sol.mustache'),
    },
    data: null,
    previousData: null
  };
});
