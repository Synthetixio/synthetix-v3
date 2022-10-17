const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { ContractValidationError } = require('../../src/internal/errors');

describe('missing-interface', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('missing-interface');
  });

  describe('when deploying a project with missing interfaces', function () {
    it('throws an error when the required interface is missing', async function () {
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
