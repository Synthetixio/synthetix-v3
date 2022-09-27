const fs = require('fs');
const path = require('path');

require('@nomiclabs/hardhat-etherscan');
require('@tenderly/hardhat-tenderly');

// Forces "use strict" on all modules.
require('use-strict');

// Loads all plugin files.
_requireAll(`${__dirname}/tasks`);
_requireAll(`${__dirname}/subtasks`);
_requireAll(`${__dirname}/extensions`);

function _requireAll(pathname) {
  return fs
    .readdirSync(path.resolve(pathname))
    .filter((filename) => path.extname(filename) === '.js')
    .map((filename) => require(path.resolve(pathname, filename)));
}
