const { ok } = require('assert/strict');
const { useEnvironment } = require('../../helpers');
const { TASK_DEPLOY } = require('../../../task-names');

describe('tasks/deploy.js', function () {
  useEnvironment('complete-run');

  it('extends the configuration and the environment', function () {
    ok(this.hre.config.deployer);
    ok(this.hre.deployer);
  });

  it('correctly executes several deployments', async function () {
    this.timeout(25000);

    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: true,
      alias: 'first',
      instance: 'test',
    });

    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: false,
      alias: 'second',
      instance: 'test',
    });
  });
});
