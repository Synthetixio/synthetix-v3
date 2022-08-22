//import '@typechain/hardhat'

import '@nomiclabs/hardhat-ethers';

import commonConfig from '@synthetixio/common-config/hardhat.config';
import { HardhatUserConfig } from 'hardhat/types';

const config: HardhatUserConfig = {
  ...commonConfig,
  solidity: '0.8.11',
};

export default config;

/*export default {
  ...require('@synthetixio/common-config/hardhat.config.js'),
  router: {
    proxyContract: 'Synthetix',
  },
};*/
