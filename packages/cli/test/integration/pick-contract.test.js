const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-contract', function () {
  bootstrap();

  before('start the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
  });

  it('displays the contract list', async function () {
    this.cli.printed('Pick a CONTRACT');
    this.cli.printed('SomeModule');
    this.cli.printed('UpgradeModule');
    this.cli.printed('Proxy');
  });

  describe('when ctrl-c is pressed', function () {
    before('press ctrl-c', async function () {
      this.timeout(60000);

      await this.cli.interact(this.cli.keys.CTRLC);
    });

    it('exits', async function () {
      assert.equal(this.cli.status, 'stopped');
      assert.deepEqual(this.cli.errors, []);
    });
  });
});
