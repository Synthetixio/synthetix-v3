require('@nomiclabs/hardhat-ethers');
require('hardhat-cannon');
require('@synthetixio/hardhat-storage');
require('solidity-coverage');

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
