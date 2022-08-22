const path = require('path');
const { equal } = require('assert/strict');
const { TASK_DEPLOY_MULTICALL_ABI } = require('../../task-names');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { copyFile, unlink, readFile, writeFile } = require('fs/promises');

describe('sample-project', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment(
      path.dirname(require.resolve('@synthetixio/sample-project/package.json'))
    );
  });

  describe('when deploying without any changes', function () {
    it('correctly runs the initial deployment', async function () {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'first',
        clear: true,
      });
    });

    it('generates multicall ABI', async function () {
      const multiResult = await hre.run(TASK_DEPLOY_MULTICALL_ABI, {
        instance: 'test',
        quiet: true,
      });

      equal(multiResult.abi.length, 34);

      const singleResult = await hre.run(TASK_DEPLOY_MULTICALL_ABI, {
        include: 'contracts/modules/SomeModule.sol:SomeModule',
        instance: 'test',
        quiet: true,
      });

      equal(singleResult.abi.length, 5);
    });

    it('correctly executes the second time and makes no changes', async function () {
      this.timeout(60000);

      await deployOnEnvironment(hre, {
        alias: 'second',
      });
    });

    describe('when changing files', function () {
      it('correctly applies changes on deployment', async function () {
        this.timeout(120000);

        await deployOnEnvironment(hre, {
          alias: 'changes',
        });

        // Third deployment, with changes
        const MODULES = hre.config.router.paths.modules;
        const CONTRACTS = path.resolve(__dirname, '..', 'fixtures', 'contracts');

        const SomeModuleOriginal = await readFile(path.join(MODULES, 'SomeModule.sol'));
        const AnotherModuleOriginal = await readFile(path.join(MODULES, 'AnotherModule.sol'));
        const SettingsModuleOriginal = await readFile(path.join(MODULES, 'SettingsModule.sol'));

        try {
          // Make some file changes before deploying
          await Promise.all([
            // Create new module
            copyFile(path.join(CONTRACTS, 'NewModule.sol'), path.join(MODULES, 'NewModule.sol')),
            // Modify existing modules
            copyFile(
              path.join(CONTRACTS, 'SomeModule.modified.sol'),
              path.join(MODULES, 'SomeModule.sol')
            ),
            // Delete existing modules
            unlink(path.join(MODULES, 'AnotherModule.sol')),
            unlink(path.join(MODULES, 'SettingsModule.sol')),
          ]);

          await deployOnEnvironment(hre, {
            alias: 'third',
          });
        } finally {
          // Restore all the changes
          await Promise.all([
            unlink(path.join(MODULES, 'NewModule.sol')),
            writeFile(path.join(MODULES, 'SomeModule.sol'), SomeModuleOriginal),
            writeFile(path.join(MODULES, 'AnotherModule.sol'), AnotherModuleOriginal),
            writeFile(path.join(MODULES, 'SettingsModule.sol'), SettingsModuleOriginal),
          ]);
        }
      });
    });
  });
});
