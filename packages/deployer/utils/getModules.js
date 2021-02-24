function getModules({ hre }) {
  const data = hre.deployer.data;

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
