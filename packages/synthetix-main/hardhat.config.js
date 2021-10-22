require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');

module.exports = {
  solidity: '0.8.4',
  deployer: {},
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
  },
};
