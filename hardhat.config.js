require('@nomiclabs/hardhat-waffle');
require('@synthetixio/deployer');

module.exports = {
  solidity: '0.7.3',
  deployer: {
    paths: {
      modules: 'contracts/modules',
      deployments: 'deployments',
    },
  },
};
