const fs = require('fs');
const path = require('path');

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(hre.config.paths.root, 'package.json')));
}

module.exports = {
  readPackageJson,
};
