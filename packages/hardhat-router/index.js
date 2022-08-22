const { requireAll } = require('@synthetixio/core-utils/dist/utils/misc/require-all');

require('@nomiclabs/hardhat-etherscan');
require('@tenderly/hardhat-tenderly');

// Forces "use strict" on all modules.
require('use-strict');

// Loads all plugin files.
requireAll(`${__dirname}/tasks`);
requireAll(`${__dirname}/subtasks`);
requireAll(`${__dirname}/extensions`);
