const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('execute-call', function () {
  bootstrap();

  describe('read only call', function () {
    before('use the cli', async function () {
      this.timeout(60000);

      await this.cli.start();
      await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
      // TODO: Throws an exception here:
      // This seems to be because the main process (tests) hardhat network is a
      // different instance from the subproces (cli) hardhat network.
      // The solution would be to use the local network in these tests,
      // started in a different process.
      // await this.cli.interact(this.cli.keys.ENTER); // Selects getUintValue
      // await this.cli.interact(this.cli.keys.CTRLC); // Return to function list
      await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
      await this.cli.interact(this.cli.keys.CTRLC); // Exit

      assert.deepEqual(this.cli.errors, []);
    });

    // TODO
    it('TODO', async function () {});
  });

  describe('write call', function () {
    // TODO
  });
});
