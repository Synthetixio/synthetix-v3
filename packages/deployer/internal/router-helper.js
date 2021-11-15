const fs = require('fs');
const path = require('path');

/**
 * Converts the contracts name to private _CONSTANT_CASE format.
 * E.g.:
 *   'BearableModule' => '_BEARABLE_MODULE'
 *   'Proxy' => '_PROXY'
 *   'ERC20Token' => '_ERC20_TOKEN'
 */
function toPrivateConstantCase(name) {
  return name.replace(/(?<![A-Z])[A-Z]/g, '_$&').toUpperCase();
}

function getRouterSource() {
  const routerPath = path.join(hre.config.paths.sources, 'Router.sol');
  const source = fs.readFileSync(routerPath).toString();
  return source;
}

module.exports = {
  toPrivateConstantCase,
  getRouterSource,
};
