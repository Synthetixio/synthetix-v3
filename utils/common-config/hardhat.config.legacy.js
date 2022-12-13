const path = require('path');
const dotenv = require('dotenv');

// Load common .env file from root
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

require('@typechain/hardhat');
require('@nomiclabs/hardhat-ethers');
//require('@nomiclabs/hardhat-waffle');
require('hardhat-contract-sizer');
require('solidity-coverage');
require('@synthetixio/hardhat-router');
require('@synthetixio/hardhat-storage');
require('hardhat-gas-reporter');
require('hardhat-ignore-warnings');

require('hardhat-cannon');

const config = {
  solidity: {
    version: '0.8.17',
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
      gas: 12000000, // Prevent gas estimation for better error results in tests
    },
    hardhat: {
      gas: 12000000, // Prevent gas estimation for better error results in tests
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
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 5,
    },
  },
  defaultNetwork: 'cannon',
  gasReporter: {
    url: 'http://localhost:8545',
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

module.exports = config;
