import commonConfig from '@synthetixio/common-config/hardhat.config';
import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

import './tasks/dev';

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
      './modules',
      './mocks',
      './storage',
      './submodules',
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
