import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-cannon';

const config = require('@synthetixio/common-config/hardhat.config.js');

module.exports = {
  ...config,
  deployer: {
    proxyContract: 'Synthetix',
  },
};
