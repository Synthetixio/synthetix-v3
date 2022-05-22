const { requireAll } = require('@synthetixio/core-js/utils/misc/require-all');

require('dotenv/config');
require('hardhat-contract-sizer');
require('hardhat-cannon');
require('solidity-coverage');
require('@nomiclabs/hardhat-ethers');
require('@synthetixio/deployer');
require('@synthetixio/cli');

requireAll(`${__dirname}/tasks`);

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
    proxyContract: 'Proxy',
  },
  contractSizer: {
    strict: true,
  },
  cannon: {},
};

// Config only necessary for publishing cannon package
if (process.env.CANNON_PUBLISHER_PRIVATE_KEY) {
  config.cannon.publisherPrivateKey = process.env.CANNON_PUBLISHER_PRIVATE_KEY;
  config.cannon.ipfsConnection = {
    protocol: 'https',
    host: 'ipfs.infura.io',
    port: 5001,
    headers: {
      authorization: `Basic ${Buffer.from(
        process.env.INFURA_IPFS_ID + ':' + process.env.INFURA_IPFS_SECRET
      ).toString('base64')}`,
    },
  };
}

module.exports = config;
