const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { SatellitesValidationError } = require('../../internal/satellites-validator');

describe('inconsistent-satellites', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('inconsistent-satellites');
  });

  describe('when deploying a project with problems in satellite factory modules', function () {
    it('throws an error when the required functions are not there', async function () {
      this.timeout(60000);

      await rejects(async () => {
        await deployOnEnvironment(hre, {
          alias: 'first',
          clear: true,
        });
      }, SatellitesValidationError);
    });
  });
});
