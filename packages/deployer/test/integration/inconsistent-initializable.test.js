const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { ContractValidationError } = require('../../internal/errors');

describe('inconsistent-initializable', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('inconsistent-initializable');
  });

  describe('when deploying a project with problems in initializable modules', function () {
    it('throws an error when the required functions are not there', async function () {
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
