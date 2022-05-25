const { extendEnvironment } = require('hardhat/config');

extendEnvironment((hre) => {
  if (hre.cli) {
    throw new Error('Cli plugin already loaded.');
  }

  hre.cli = {
    contractFullyQualifiedName: null,
    contractDeployedAddress: null,
    functionAbi: null,
    functionParameters: null,
  };

  // Prevent any properties being added to hre.cli
  // other than those defined above.
  Object.preventExtensions(hre.cli);

  for (const value of Object.values(hre.cli)) {
    Object.preventExtensions(value);
  }
});
