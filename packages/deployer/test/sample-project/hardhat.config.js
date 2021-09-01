require('@nomiclabs/hardhat-waffle');
require('../../index');

module.exports = {
  solidity: '0.8.4',
  deployer: {
    proxyName: 'MainProxy',
  },
  defaultNetwork: 'local',
  networks: {
    local: {
      url: 'http://localhost:8545',
    },
  },
};
