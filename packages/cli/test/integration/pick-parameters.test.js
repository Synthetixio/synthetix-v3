const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-parameters', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact('SomeModule'); // Filter SomeModule
    await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
    await this.cli.interact('setUintValue'); // Highlights setUintValue
    await this.cli.interact(this.cli.keys.ENTER); // Selects setUintValue
    await this.cli.interact('ngmi'); // Invalid input for "newValue"
    await this.cli.interact(this.cli.keys.ENTER); // Submit input
    await this.cli.interact('1337'); // Valid input for "newValue"
    await this.cli.interact(this.cli.keys.ENTER); // Submit input
    await this.cli.interact(this.cli.keys.CTRLC); // Cancel transaction
    // HERE
    await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  it('displays an error', async function () {
    await this.cli.printed('Error: invalid BigNumber string');
  });

  it('displays the function to be called', async function () {
    await this.cli.printed('Calling contracts/modules/SomeModule.sol:SomeModule.setUintValue');
  });
});
