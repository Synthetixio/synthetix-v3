import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  docgen: {
    exclude: [
      './interfaces/external',
      './mocks',
      './modules',
      './storage',
      './utils',
      './Proxy.sol',
    ],
    templates,
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
