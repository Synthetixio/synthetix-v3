//import '@typechain/hardhat'

import '@nomiclabs/hardhat-ethers';
import 'solidity-docgen';

import commonConfig from '@synthetixio/common-config/hardhat.config';

const config = {
  ...commonConfig,
  solidity: '0.8.11',
  docgen: {
    exclude: [
      './interfaces/external',
      './modules',
      './mixins',
      './mocks',
      './utils',
      './storage',
      './Proxy.sol',
      './Router.sol',
    ],
  },
};

export default config;
