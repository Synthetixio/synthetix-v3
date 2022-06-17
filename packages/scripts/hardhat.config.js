const { requireAll } = require('@synthetixio/core-js/utils/misc/require-all');
const config = require('@synthetixio/common-config/hardhat.config.js');

requireAll(`${__dirname}/tasks`);

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = config;
