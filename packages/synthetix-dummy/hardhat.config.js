require('dotenv').config();
require('@nomiclabs/hardhat-ethers');

require('@synthetixio/synthetix-cli');

module.exports = {
  defaultNetwork: 'kovan',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  cli: {
    artifacts: './deployments',
  },
};
