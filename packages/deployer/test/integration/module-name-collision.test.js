const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe('module-name-collision', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('module-name-collision');
  });

  describe('when deploying a project with module name collisions', function () {
    it('succeeds', async function () {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
      });
    });
  });
});
