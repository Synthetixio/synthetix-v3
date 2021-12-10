const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('pick-function', function () {
  bootstrap();

  before('start the cli and navigate', async function () {
    this.timeout(60000);

    await this.cli.start();

    await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
  });

  after('clear output buffer', async function () {
    this.cli.clear();
  });

  it('displays the function list', async function () {
    this.cli.printed('SomeModule.setUintValue(uint256 newValue) 0x2f3b21a2');
  });

  describe('when ctrl-c is pressed', function () {
    before('press ctrl-c', async function () {
      this.timeout(60000);

      await this.cli.interact(this.cli.keys.CTRLC);
    });

    describe('when ctrl-c is pressed again', function () {
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
});
