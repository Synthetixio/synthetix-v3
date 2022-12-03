const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe.skip('sibling-contracts', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('sibling-contracts');
  });

  describe('when deploying a project with several modules defined on the same file', function () {
    it('correctly deploys them', async function () {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
      });
    });
  });
});
