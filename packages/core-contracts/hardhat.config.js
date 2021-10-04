require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');

module.exports = {
  solidity: '0.8.4',
  networks: {
    local: {
      url: "http://localhost:8545"
    }
  }
};
