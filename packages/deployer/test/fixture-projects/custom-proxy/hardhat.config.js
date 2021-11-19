require('@nomiclabs/hardhat-ethers');
require('../../..');

module.exports = {
  solidity: '0.8.4',
  deployer: {
    proxyContract: 'CustomProxy',
  },
};
