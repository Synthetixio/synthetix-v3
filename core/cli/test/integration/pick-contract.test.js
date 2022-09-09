const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-contract', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  it('displays the contract list', async function () {
    this.cli.printed('Pick a CONTRACT');
    this.cli.printed('SomeModule');
    this.cli.printed('UpgradeModule');
    this.cli.printed('Proxy');
    this.cli.printed('Router');
  });
});
