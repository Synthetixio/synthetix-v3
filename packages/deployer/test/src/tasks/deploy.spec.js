const path = require('path');
const { copyFile, unlink } = require('fs/promises');
const { useEnvironment } = require('../../helpers');
const { TASK_DEPLOY } = require('../../../task-names');

describe('tasks/deploy.js', function () {
  useEnvironment('sample-project');

  it('correctly executes several deployments with no changes', async function () {
    this.timeout(25000);

    // Initial deployment
    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: true,
      alias: 'first',
      instance: 'test',
    });

    // Second deployment, without any changes
    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: false,
      alias: 'second',
      instance: 'test',
    });
  });

  // TODO: enable this test when module initialization is implemented
  // More info: https://github.com/Synthetixio/synthetix-v3/issues/193
  it.skip('correctly executes several deployments with changes', async function () {
    this.timeout(25000);

    // Initial deployment
    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: true,
      alias: 'first',
      instance: 'test',
    });

    // Second deployment, without any changes
    await this.hre.run(TASK_DEPLOY, {
      noConfirm: true,
      quiet: true,
      clear: false,
      alias: 'second',
      instance: 'test',
    });

    // Third deployment
    const MODULES = this.hre.config.deployer.paths.modules;
    const CONTRACTS = path.join(this.hre.config.paths.root, 'test-contracts');
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
        unlink(path.join(MODULES, 'OwnerModule.sol')),
      ]);

      await this.hre.run(TASK_DEPLOY, {
        noConfirm: true,
        quiet: true,
        clear: false,
        alias: 'third',
        instance: 'test',
      });
    } finally {
      // Restore all the changes
      await Promise.all([
        unlink(path.join(MODULES, 'NewModule.sol')),
        copyFile(
          path.join(CONTRACTS, 'SomeModule.original.sol'),
          path.join(MODULES, 'SomeModule.sol')
        ),
        copyFile(
          path.join(CONTRACTS, 'OwnerModule.original.sol'),
          path.join(MODULES, 'OwnerModule.sol')
        ),
      ]);
    }
  });
});
