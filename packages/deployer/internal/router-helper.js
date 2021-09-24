const fs = require('fs');
const path = require('path');
const relativePath = require('@synthetixio/core-js/utils/relative-path');

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
  const routerPath = path.join(
    relativePath(hre.config.paths.sources, hre.config.paths.root),
    'Router.sol'
  );

  const source = fs.readFileSync(routerPath).toString();
  return source;
}

module.exports = {
  toPrivateConstantCase,
  getRouterSource,
};
