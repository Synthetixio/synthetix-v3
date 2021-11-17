require('dotenv').config();

require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');

module.exports = {
  solidity: '0.8.4',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    }
  },
  deployer: {},
};
