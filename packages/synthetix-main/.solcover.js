module.exports = {
  ...require('@synthetixio/common-config/.solcover.js'),
  skipFiles: [
    'mocks',
    'Router.sol',
    'AccountRouter.sol',
    'CoreRouter.sol',
    'ESNXRouter.sol',
    'SNXRouter.sol',
    'USDRouter.sol',
  ],
};
