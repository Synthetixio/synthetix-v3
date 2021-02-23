const fs = require('fs');
const path = require('path');

function readRouterSource({ hre }) {
  const routerName = `Router_${hre.network.name}.sol`;
  const routerPath = path.join(hre.config.paths.sources, routerName);

  if (fs.existsSync(routerPath)) {
    return fs.readFileSync(routerPath, 'utf8');
  }

  return '';
}

module.exports = {
  readRouterSource,
};
