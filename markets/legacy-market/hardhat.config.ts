import commonConfig from '@synthetixio/common-config/hardhat.config';

import 'solidity-docgen';
import { templates } from '@synthetixio/docgen';

const config = {
  ...commonConfig,
  docgen: {
    exclude: [
      './generated',
      './interfaces/external',
      './InitialModuleBundle.sol',
      './LegacyMarket.sol',
      './Proxy.sol',
      './SNXDistributor.sol',
    ],
    templates,
  },
};

export default config;
