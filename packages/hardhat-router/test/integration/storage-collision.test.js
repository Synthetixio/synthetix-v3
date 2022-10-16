const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { ContractValidationError } = require('../../internal/errors');

describe.skip('storage-collision', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('storage-collision');
  });

  describe('when deploying a project with storage collisions', function () {
    it('throws an error when 2 different stores share the same location', async function () {
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
