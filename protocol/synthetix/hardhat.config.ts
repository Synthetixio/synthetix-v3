import { join, dirname } from 'path';
import commonConfig from '@synthetixio/common-config/hardhat.config';
import 'solidity-docgen';

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
      './generated',
      './routers',
      './routers',
      './modules',
      './mixins',
      './mocks',
      './storage',
      './submodules',
      './utils',
      './Proxy.sol',
    ],
    templates: join(dirname(require.resolve('@synthetixio/docgen/package.json')), 'natspec/theme'),
  },
  warnings: {
    'contracts/generated/**/*': {
      default: 'off',
    },
  },
};

export default config;
