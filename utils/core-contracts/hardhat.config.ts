import commonConfig from '@synthetixio/common-config/hardhat.config';

const config = {
  ...commonConfig,
  defaultNetwork: 'hardhat',
  mocha: {
    timeout: 120000,
  },
};

export default config;
