const config = require('@synthetixio/common-config/hardhat.config.js');

require('hardhat-cannon');

module.exports = {
  ...config,
  deployer: {
    proxyContract: 'Synthetix',
  },
};
