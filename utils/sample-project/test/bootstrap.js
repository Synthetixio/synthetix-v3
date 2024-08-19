const { coreBootstrap } = require('@synthetixio/core-utils/utils/tests');

const result = coreBootstrap();

const restoreSnapshot = result.createSnapshot();

module.exports = function sampleProjectBootstrap() {
  before(async function loadSnapshot() {
    await restoreSnapshot();
  });

  return result;
};
