const { bootstrap } = require('@synthetixio/core-router/util/bootstrap');

const result = bootstrap();

module.exports = function sampleProjectBootstrap() {
  before(async function loadSnapshot() {
    await result.restoreSnapshot();
  });

  return result;
};
