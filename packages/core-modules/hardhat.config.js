require('hardhat-contract-sizer');
require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');
require('@synthetixio/cli');

module.exports = {
  solidity: {
    version: '0.8.13',
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
  contractSizer: {
    strict: true,
  },
  mocha: {
    timeout: 120000,
  },
};
