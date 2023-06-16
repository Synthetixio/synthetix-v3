const { registerAction } = require('@usecannon/builder');

require('@nomiclabs/hardhat-ethers');
require('hardhat-cannon');
require('@synthetixio/hardhat-storage');
require('solidity-coverage');

registerAction(require('cannon-plugin-router'));

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
