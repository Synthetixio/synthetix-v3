const fs = require('fs');
const path = require('path');

function getSourceModules({ hre }) {
  const modulesPath = hre.config.deployer.paths.modules;
  return fs.readdirSync(modulesPath).map((file) => {
    const filePath = path.parse(file);
    if (filePath.ext === '.sol') {
      return filePath.name;
    }
  });
}

module.exports = {
  getSourceModules,
};
