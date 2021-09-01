const { extendEnvironment } = require('hardhat/config');

extendEnvironment((hre) => {
  if (hre.deployer) {
    throw new Error('Deployer plugin already loaded.');
  }

  hre.deployer = {
    paths: {},
  };
});
