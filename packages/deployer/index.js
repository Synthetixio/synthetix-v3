const { requireAll } = require('@synthetixio/core-js/utils/misc/require-all');

require('@nomiclabs/hardhat-etherscan');

// Forces "use strict" on all modules.
require('use-strict');

// Loads all plugin files.
requireAll(`${__dirname}/tasks`);
requireAll(`${__dirname}/subtasks`);
requireAll(`${__dirname}/extensions`);
