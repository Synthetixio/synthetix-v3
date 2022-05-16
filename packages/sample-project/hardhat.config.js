require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');

module.exports = {
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
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
