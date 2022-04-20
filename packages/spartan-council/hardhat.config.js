require('dotenv/config');

require('hardhat-contract-sizer');
require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');
require('@synthetixio/cli');

require('./tasks/test');

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
  },
  deployer: {
    proxyContract: 'SpartanCouncil',
  },
  contractSizer: {
    strict: true,
  },
};

console.log('--->', process.env.FORK_PROVIDER_URL);

if (process.env.FORK_PROVIDER_URL) {
  config.networks.hardhat = {
    forking: {
      url: process.env.FORK_PROVIDER_URL,
      blockNumber: 4838445, // 2022-03-25
    },
  };
}

module.exports = config;
