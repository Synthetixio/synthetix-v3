//import '@typechain/hardhat'

import '@nomiclabs/hardhat-ethers';
import 'solidity-docgen';

import commonConfig from '@synthetixio/common-config/hardhat.config';

const config = {
  ...commonConfig,
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  docgen: {
    exclude: [
      './interfaces/external',
      './interfaces/IUtilsModule.sol',
      './errors',
      './routers',
      './modules',
      './mixins',
      './mocks',
      './storage',
      './submodules',
      './utils',
      './Proxy.sol',
    ],
    templates: './docs/theme',
  },
};

export default config;
