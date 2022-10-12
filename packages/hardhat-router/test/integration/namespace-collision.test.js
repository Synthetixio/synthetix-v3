const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { ContractValidationError } = require('../../src/internal/errors');

describe('namespace-collision', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('namespace-collision');
  });

  describe('when deploying a project with namespace collisions', function () {
    it('throws an error when 2 different contracts have a method with the same interface', async function () {
      this.timeout(60000);

      await rejects(async () => {
        await deployOnEnvironment(hre, {
          alias: 'first',
          clear: true,
        });
      }, ContractValidationError);
    });
  });
});
