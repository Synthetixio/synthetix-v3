import 'hardhat-cannon';

const config = {
  defaultNetwork: 'cannon',
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
    cannon: {
      url: '127.0.0.1:8545',
      publicSourceCode: false, // Should publish contract sources along with bytecode?
    },
  },
};

export default config;
