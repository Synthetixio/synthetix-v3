import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  solidity: {
    version: '0.8.17',
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
    templates,
  },
  warnings: {
    'contracts/generated/**/*': {
      default: 'off',
    },
  },
};

export default config;
