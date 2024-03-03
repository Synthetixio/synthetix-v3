import commonConfig from '@synthetixio/common-config/hardhat.config';

const config = {
  ...commonConfig,
  allowUnlimitedContractSize: true,
  mocha: {
    timeout: 30_000,
  },
};

export default config;
