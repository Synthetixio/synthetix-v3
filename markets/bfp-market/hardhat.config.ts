import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  allowUnlimitedContractSize: true,
  docgen: {
    exclude: [
      './external',
      './generated',
      './mocks',
      './modules',
      './storage',
      './utils',
      './Proxy.sol',
    ],
    templates,
  },
  mocha: {
    timeout: 30_000,
  },
  storage: {
    artifacts: [
      ...commonConfig.storage.artifacts,
      '!contracts/modules/PerpRewardDistributorModule/PerpRewardDistributor.sol:PerpRewardDistributor',
    ],
  },
};

export default config;
