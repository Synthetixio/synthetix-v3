//import '@typechain/hardhat'

import '@nomiclabs/hardhat-ethers';
import 'solidity-docgen';

import commonConfig from '@synthetixio/common-config/hardhat.config';

const { cannon, ...commonConfigWithCannon } = commonConfig;

const config = {
  ...commonConfigWithCannon,
  solidity: '0.8.11',
};

export default config;
