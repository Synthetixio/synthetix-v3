const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-parameters', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
    // TODO: go down once
    // await this.cli.interact(this.cli.keys.ENTER); // Selects setUintValue
    // await this.cli.interact(this.cli.keys.CTRLC); // Return to function list
    await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  // TODO
  it('', async function () {});
});
