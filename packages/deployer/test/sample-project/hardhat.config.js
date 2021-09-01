require('@nomiclabs/hardhat-ethers');
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
