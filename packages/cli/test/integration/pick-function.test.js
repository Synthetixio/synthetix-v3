const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-function', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact('SomeModule'); // Filter SomeModule
    await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
    await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  it('displays the function list', async function () {
    this.cli.printed('setUintValue(uint256 newValue) 0x2f3b21a2');
    this.cli.printed('getUintValue() view returns (uint256) 0x55ec6354');
  });
});
