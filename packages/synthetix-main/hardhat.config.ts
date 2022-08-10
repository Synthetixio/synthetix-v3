//import '@typechain/hardhat'

import '@nomiclabs/hardhat-ethers';
import { HardhatUserConfig } from 'hardhat/types';

import commonConfig from '@synthetixio/common-config/hardhat.config';

const config: HardhatUserConfig = {
  ...commonConfig,
  solidity: "0.8.11",
};

export default config;

/*export default {
  ...require('@synthetixio/common-config/hardhat.config.js'),
  deployer: {
    proxyContract: 'Synthetix',
  },
};*/