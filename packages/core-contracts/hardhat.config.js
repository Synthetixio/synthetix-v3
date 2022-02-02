require('hardhat-contract-sizer');
require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');

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
  contractSizer: {
    strict: true,
  },
};
