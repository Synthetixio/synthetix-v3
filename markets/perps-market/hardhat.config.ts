import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  solidity: '0.8.17',
  allowUnlimitedContractSize: true,
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
    templates,
  },
  mocha: {
    timeout: 200000,
  },
};

export default config;
