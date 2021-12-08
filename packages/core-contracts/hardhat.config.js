require('hardhat-contract-sizer');
require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');

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
};
