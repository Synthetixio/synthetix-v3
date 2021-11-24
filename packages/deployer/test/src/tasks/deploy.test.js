const path = require('path');
const { rejects } = require('assert/strict');
const { copyFile, unlink, readFile, writeFile } = require('fs/promises');
const { ContractValidationError } = require('../../../internal/errors');
const { useEnvironment } = require('../../helpers');

describe('tasks/deploy.js', function () {
  describe('when deploying a correctly written project', function () {
    useEnvironment('sample-project');

    it('correctly executes several deployments with no changes', async function () {
      this.timeout(25000);

      // Initial deployment
      await this.deploySystem({
        alias: 'first',
        clear: true,
      });

      // Second deployment, without any changes
      await this.deploySystem({
        alias: 'second',
      });
    });

    it('correctly executes several deployments with changes', async function () {
      this.timeout(25000);

      // Initial deployment
      await this.deploySystem({
        alias: 'first',
        clear: true,
      });

      // Second deployment, without any changes
      await this.deploySystem({
        alias: 'second',
      });

      // Third deployment
      const MODULES = this.hre.config.deployer.paths.modules;
      const CONTRACTS = path.join(this.hre.config.paths.root, 'test-contracts');

      const SomeModuleOriginal = await readFile(path.join(MODULES, 'SomeModule.sol'));
      const AnotherModuleOriginal = await readFile(path.join(MODULES, 'AnotherModule.sol'));

      try {
        // Make some file changes before deploying
        await Promise.all([
          // Create new module
          copyFile(path.join(CONTRACTS, 'NewModule.sol'), path.join(MODULES, 'NewModule.sol')),
          // Modify a existing module
          copyFile(
            path.join(CONTRACTS, 'SomeModule.modified.sol'),
            path.join(MODULES, 'SomeModule.sol')
          ),
          // Delete a existing module
          unlink(path.join(MODULES, 'AnotherModule.sol')),
        ]);

        await this.deploySystem({
          alias: 'third',
        });
      } finally {
        // Restore all the changes
        await Promise.all([
          unlink(path.join(MODULES, 'NewModule.sol')),
          writeFile(path.join(MODULES, 'SomeModule.sol'), SomeModuleOriginal),
          writeFile(path.join(MODULES, 'AnotherModule.sol'), AnotherModuleOriginal),
        ]);
      }
    });
  });

  describe('when deploying a project with namespace collisions', function () {
    useEnvironment('namespace-collision');

    it('throws an error when 2 different contracts have a method with the same interface', async function () {
      this.timeout(25000);

      await rejects(async () => {
        // Initial deployment
        await this.deploySystem({
          alias: 'first',
          clear: true,
        });
      }, ContractValidationError);
    });
  });

  describe('when deploying a project with a custom Proxy', function () {
    useEnvironment('custom-proxy');

    it('correctly executes several deployments with no changes', async function () {
      this.timeout(25000);

      await this.deploySystem({
        alias: 'first',
        clear: true,
      });

      await this.deploySystem({
        alias: 'second',
      });
    });

    it('throws an error when changing the proxy name', async function () {
      this.timeout(25000);

      // Initial deployment
      await this.deploySystem({
        alias: 'first',
        clear: true,
      });

      this.hre.config.deployer.proxyContract = 'AlternativeProxy';

      await rejects(async () => {
        await this.deploySystem({
          alias: 'second',
        });
      }, ContractValidationError);
    });

    it('throws an error when editing the proxy contract', async function () {
      this.timeout(25000);

      this.hre.config.deployer.proxyContract = 'Proxy';

      const { root, sources } = this.hre.config.paths;

      // Create the Proxy
      await copyFile(path.join(root, 'Proxy.original.sol'), path.join(sources, 'Proxy.sol'));

      // Deploy for the first time
      await this.deploySystem({
        alias: 'first',
        clear: true,
      });

      // Edit the Proxy
      await copyFile(path.join(root, 'Proxy.edited.sol'), path.join(sources, 'Proxy.sol'));

      // Try to re-deploy with a changed Proxy
      await rejects(async () => {
        await this.deploySystem({
          alias: 'second',
        });
      }, ContractValidationError);
    });
  });
});
