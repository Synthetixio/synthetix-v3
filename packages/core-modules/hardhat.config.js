const config = require('@synthetixio/common-config/hardhat.config.js');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  ...config,
  mocha: {
    timeout: 120000,
  },
};
