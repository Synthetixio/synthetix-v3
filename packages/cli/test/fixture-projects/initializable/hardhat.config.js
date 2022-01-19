require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');
require('../../..');

module.exports = {
  solidity: {
    version: '0.8.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
  },
  deployer: {},
};
