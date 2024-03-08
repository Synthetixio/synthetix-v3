import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
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
    timeout: 30_000,
  },
  storage: {
    contracts: [
      'contracts/**',
      '!contracts/routers/**',
      '!contracts/generated/**',
      '!contracts/mocks/**',
      '!contracts/Router.sol',
      '!contracts/modules/PerpRewardDistributorModule/PerpRewardDistributor.sol',
      '!contracts/external/**/*',
    ],
  },
};

export default config;
