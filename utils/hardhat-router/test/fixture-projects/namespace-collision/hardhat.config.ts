import '@nomiclabs/hardhat-ethers';
import '@synthetixio/hardhat-storage';
import '../../../src';

export default {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
