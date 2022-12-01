import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
//import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import '@synthetixio/hardhat-router';
import 'hardhat-gas-reporter';
import 'hardhat-cannon';

import dotenv from 'dotenv';
import path from 'node:path';

// Load common .env file from root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

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
      chainId: 31337,
    },
    mainnet: {
      url:
        process.env.NETWORK_ENDPOINT ||
        'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1,
    },
    ['optimistic-goerli']: {
      url:
        process.env.NETWORK_ENDPOINT ||
        `https://optimism-goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 420,
    },
    ['optimistic-mainnet']: {
      url:
        process.env.NETWORK_ENDPOINT ||
        `https://optimism.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 10,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 5,
    },
    ['avalanche-fuji']: {
      url: `https://avalanche-fuji.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 43113,
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
  },
  contractSizer: {
    strict: true,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      optimisticEthereum: process.env.OVM_ETHERSCAN_API_KEY,
      optimisticGoerli: process.env.OVM_ETHERSCAN_API_KEY,
      avalancheFujiTestnet: process.env.ETHERSCAN_API_KEY,
    },
  },
  tenderly: {
    project: 'synthetix',
    username: 'synthetix-services',
  },
  cannon: {
    ipfsEndpoint: 'https://ipfs.infura.io:5001',
    ipfsAuthorizationHeader: `Basic ${Buffer.from(
      process.env.INFURA_IPFS_ID + ':' + process.env.INFURA_IPFS_SECRET
    ).toString('base64')}`,
  },
};

export default config;
