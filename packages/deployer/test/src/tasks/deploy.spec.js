const { ok } = require('assert/strict');
const { useEnvironment } = require('../../helpers');

describe('tasks/deploy.js', function () {
  useEnvironment('complete-run');

  it('extends the configuration and the environment', function () {
    ok(this.hre.config.deployer);
    ok(this.hre.deployer);
  });
});
