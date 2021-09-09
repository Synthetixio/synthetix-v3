module.exports = {
  readPackageJson: () => require(`${hre.config.paths.root}/package.json`),
};
