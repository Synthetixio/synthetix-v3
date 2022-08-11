const config = require('@synthetixio/common-config/hardhat.config.legacy');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  ...config,
  mocha: {
    timeout: 120000,
  },
};
