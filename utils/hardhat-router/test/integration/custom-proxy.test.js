const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { rejects } = require('assert/strict');
const { ContractValidationError } = require('../../src/internal/errors');
const { copyFile } = require('fs/promises');

describe.skip('custom-proxy', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('custom-proxy');
  });

  describe('when deploying a project with a custom Proxy', function () {
    it('correctly executes several deployments with no changes', async function () {
      this.timeout(120000);

      await deployOnEnvironment(hre);

      await deployOnEnvironment(hre, {
        alias: 'second',
      });
    });

    it('throws an error when changing the proxy name', async function () {
      this.timeout(60000);

      // Initial deployment
      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
      });

      hre.config.router.proxyContract = 'AlternativeProxy';

      await rejects(async () => {
        await deployOnEnvironment(hre, {
          alias: 'second',
        });
      }, ContractValidationError);
    });

    it('throws an error when editing the proxy contract', async function () {
      this.timeout(60000);

      hre.config.router.proxyContract = 'Proxy';

      const { root, sources } = hre.config.paths;

      // Create the Proxy
      await copyFile(path.join(root, 'Proxy.original.sol'), path.join(sources, 'Proxy.sol'));

      // Deploy for the first time
      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
      });

      // Edit the Proxy
      await copyFile(path.join(root, 'Proxy.edited.sol'), path.join(sources, 'Proxy.sol'));

      // Try to re-deploy with a changed Proxy
      await rejects(async () => {
        await deployOnEnvironment(hre, {
          alias: 'second',
        });
      }, ContractValidationError);
    });
  });
});
