require('dotenv').config();

require('@nomiclabs/hardhat-waffle');
require('@synthetixio/deployer');

module.exports = {
  solidity: {
    version: '0.7.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  deployer: {
    paths: {
      modules: 'contracts/modules',
      deployments: 'deployments',
    },
    proxyName: 'Synthetix',
  },
  defaultNetwork: 'kovan',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
};
