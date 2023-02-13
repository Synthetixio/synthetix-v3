import 'solidity-docgen';

import commonConfig from '@synthetixio/common-config/hardhat.config';

const config = {
  ...commonConfig,
  mocha: {
    timeout: 400000,
  },
  solidity: '0.8.17',
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
