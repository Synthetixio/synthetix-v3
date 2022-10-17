require('@nomiclabs/hardhat-ethers');
require('../../../src');

module.exports = {
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  router: {
    proxyContract: 'CustomProxy',
  },
};
