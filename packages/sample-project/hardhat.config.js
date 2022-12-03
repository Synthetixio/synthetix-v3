require('@nomiclabs/hardhat-ethers');
require('@synthetixio/hardhat-router');
require('hardhat-cannon');

module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: 'cannon',
};
