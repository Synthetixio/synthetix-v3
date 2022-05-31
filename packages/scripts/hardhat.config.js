const { requireAll } = require('@synthetixio/core-js/utils/misc/require-all');

require('dotenv/config');
require('@nomiclabs/hardhat-ethers');

requireAll(`${__dirname}/tasks`);

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config = {
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
    ['optimistic-kovan']: {
      url: 'https://kovan.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    ['optimistic-mainnet']: {
      url: 'https://mainnet.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

module.exports = config;
