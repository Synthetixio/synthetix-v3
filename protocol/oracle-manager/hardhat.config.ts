import commonConfig from '@synthetixio/common-config/hardhat.config';
import 'solidity-docgen';

const config = {
  ...commonConfig,
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
