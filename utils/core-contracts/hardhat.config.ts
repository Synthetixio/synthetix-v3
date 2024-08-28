import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  defaultNetwork: 'hardhat',
  docgen: {
    exclude: [
      './errors',
      './generated',
      './initializable',
      './interfaces/external',
      './mocks',
      './ownership',
      './proxy',
      './token',
      './utils',
    ],
    templates,
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
