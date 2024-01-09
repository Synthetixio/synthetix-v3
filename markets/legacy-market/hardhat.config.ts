import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  docgen: {
    exclude: [
      './interfaces/external',
      './interfaces/IUtilsModule.sol',
      './modules',
      './mixins',
      './mocks',
      './storage',
      './submodules',
      './utils',
      './Proxy.sol',
      './Router.sol',
    ],
    templates,
  },
};

export default config;
