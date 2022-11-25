import '@nomiclabs/hardhat-ethers';
import '../../../src';

export default {
  solidity: {
    version: '0.8.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
