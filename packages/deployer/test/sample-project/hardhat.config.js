require('@nomiclabs/hardhat-waffle');
require('../../index');

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
    proxyName: 'Main',
  },
  defaultNetwork: 'local',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
  },
};
