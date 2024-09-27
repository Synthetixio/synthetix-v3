import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
//import '@nomicfoundation/hardhat-foundry'
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
  mocha: {
    timeout: 30_000,
  },
};

export default config;
