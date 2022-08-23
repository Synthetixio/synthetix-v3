import path from 'node:path';
import dotenv from 'dotenv';

// Load common .env file from root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
// Load common .env file at ./packages/config-common/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

import '@nomiclabs/hardhat-ethers';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import '@synthetixio/hardhat-router';
import '@synthetixio/cli';

import 'hardhat-cannon';

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
      url: process.env.NETWORK_ENDPOINT || 'https://kovan.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    ['optimistic-mainnet']: {
      url: process.env.NETWORK_ENDPOINT || 'https://mainnet.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  contractSizer: {
    strict: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  tenderly: {
    project: 'synthetix',
    username: 'synthetix-services',
  },
};

export default config;
