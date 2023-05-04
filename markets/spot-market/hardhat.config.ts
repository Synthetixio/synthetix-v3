import 'solidity-docgen';

import commonConfig from '@synthetixio/common-config/hardhat.config';

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
  },
  warnings: {
    'contracts/mocks/**/*': {
      default: 'off',
    },
  },
};

export default config;
