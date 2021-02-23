const { readDeploymentFile } = require('../utils/deploymentFile');

function getModules({ hre }) {
  const data = readDeploymentFile({ hre });

  const allModules = Object.keys(data.modules).map((moduleName) => {
    const { deployedAddress } = data.modules[moduleName];

    return {
      name: moduleName,
      address: deployedAddress,
    };
  });

  return allModules;
}

module.exports = {
  getModules,
};
