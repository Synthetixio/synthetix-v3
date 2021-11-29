const path = require('path');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');
const { copyFile, unlink, readFile, writeFile } = require('fs/promises');

describe('sample-project', function () {
  let hre;

  beforeEach('set fixture project', function () {
    hre = loadEnvironment('sample-project');
  });

  it('correctly executes several deployments with no changes', async function () {
    this.timeout(120000);

    // Initial deployment
    await deployOnEnvironment(hre, {
      alias: 'first',
      clear: true,
    });

    // Second deployment, without any changes
    await deployOnEnvironment(hre, {
      alias: 'second',
    });
  });

  it('correctly executes several deployments with changes', async function () {
    this.timeout(120000);

    // Initial deployment
    await deployOnEnvironment(hre, {
      alias: 'first',
      clear: true,
    });

    // Second deployment, without any changes
    await deployOnEnvironment(hre, {
      alias: 'second',
    });

    // Third deployment, with changes
    const MODULES = hre.config.deployer.paths.modules;
    const CONTRACTS = path.join(hre.config.paths.root, 'test-contracts');

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

      await deployOnEnvironment(hre, {
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
