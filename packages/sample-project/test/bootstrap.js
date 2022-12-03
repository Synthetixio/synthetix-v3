const { coreBootstrap } = require('@synthetixio/core-router/util/core-bootstrap');

const result = coreBootstrap();

const restoreSnapshot = result.createSnapshot();

module.exports = function sampleProjectBootstrap() {
  before(async function loadSnapshot() {
    await restoreSnapshot();
  });

  return result;
};
