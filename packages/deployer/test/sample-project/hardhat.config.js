require('@nomiclabs/hardhat-waffle');
require('../../index');

module.exports = {
  solidity: '0.7.3',
  deployer: {
    paths: {
      modules: 'contracts/modules',
      deployments: 'deployments',
    },
  },
  defaultNetwork: 'local',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
  },
};
