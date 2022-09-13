import '@nomiclabs/hardhat-ethers';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import '@synthetixio/hardhat-router';
import '@synthetixio/cli';
import 'hardhat-gas-reporter';
import 'hardhat-cannon';

import dotenv from 'dotenv';
import path from 'node:path';

// Load common .env file from root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
// Load common .env file at ./packages/config-common/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

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
  defaultNetwork: 'cannon',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
    ['optimistic-kovan']: {
      url: process.env.NETWORK_ENDPOINT || 'https://kovan.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    ['optimistic-mainnet']: {
      url: process.env.NETWORK_ENDPOINT || 'https://mainnet.optimism.io',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 5,
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
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
  cannon: {
    ipfsConnection: {
      protocol: 'https',
      host: 'ipfs.infura.io',
      port: 5001,
      headers: {
        authorization: `Basic ${Buffer.from(
          process.env.INFURA_IPFS_ID + ':' + process.env.INFURA_IPFS_SECRET
        ).toString('base64')}`,
      },
    },
  },
};

export default config;
