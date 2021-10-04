const fs = require('fs');
const path = require('path');

function readPackageJson() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkgStr = fs.readFileSync(pkgPath, 'utf8');

  return JSON.parse(pkgStr);
}

module.exports = {
  readPackageJson,
};
