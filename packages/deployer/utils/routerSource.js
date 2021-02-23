const fs = require('fs');

function readRouterSource({ hre }) {
  const routerName = `Router_${hre.network.name}.sol`;
  const routerPath = `contracts/${routerName}`;

  if (fs.existsSync(routerPath)) {
    return fs.readFileSync(routerPath, 'utf8');
  }

  return '';
}

module.exports = {
  readRouterSource,
};
