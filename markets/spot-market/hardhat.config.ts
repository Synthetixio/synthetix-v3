import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  allowUnlimitedContractSize: true,
  docgen: {
    exclude: [
      './generated',
      './interfaces/external',
      './mocks',
      './modules',
      './storage',
      './utils',
      './Mocks.sol',
      './Proxy.sol',
    ],
    templates,
  },
  warnings: {
    'contracts/mocks/**/*': {
      default: 'off',
    },
  },
  mocha: {
    timeout: 30_000,
  },
};

export default config;
