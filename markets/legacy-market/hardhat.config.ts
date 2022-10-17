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
      './interfaces/IUtilsModule.sol',
      './modules',
      './mixins',
      './mocks',
      './storage',
      './submodules',
      './utils',
      './Proxy.sol',
      './Router.sol',
    ],
    templates: './docs/theme',
  },
};

export default config;
