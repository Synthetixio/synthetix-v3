require('@nomiclabs/hardhat-ethers');
require('@synthetixio/hardhat-router');
require('@synthetixio/hardhat-storage');
require('hardhat-cannon');

require('@synthetixio/router/dist/src/utils/cannon');

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
