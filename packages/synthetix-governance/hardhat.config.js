const { requireAll } = require('@synthetixio/core-js/utils/misc/require-all');
const commonConfig = require('@synthetixio/common-config/hardhat.config.js');

require('dotenv/config');
require('hardhat-cannon');

requireAll(`${__dirname}/tasks`);

const config = {
  ...commonConfig,
  cannon: {},
};

// Config only necessary for publishing cannon package
if (process.env.CANNON_PUBLISHER_PRIVATE_KEY) {
  config.cannon.publisherPrivateKey = process.env.CANNON_PUBLISHER_PRIVATE_KEY;
  config.cannon.ipfsConnection = {
    protocol: 'https',
    host: 'ipfs.infura.io',
    port: 5001,
    headers: {
      authorization: `Basic ${Buffer.from(
        process.env.INFURA_IPFS_ID + ':' + process.env.INFURA_IPFS_SECRET
      ).toString('base64')}`,
    },
  };
}

module.exports = config;
