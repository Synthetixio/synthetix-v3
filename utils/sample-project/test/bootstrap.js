const { coreBootstrap } = require('@synthetixio/router/dist/utils/tests');

const result = coreBootstrap();

const restoreSnapshot = result.createSnapshot();

module.exports = function sampleProjectBootstrap() {
  before(async function loadSnapshot() {
    await restoreSnapshot();
  });

  return result;
};
