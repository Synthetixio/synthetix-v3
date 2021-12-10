const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('print-info', function () {
  bootstrap();

  before('start the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
  });

  it('displays the project name and title', async function () {
    this.cli.printed('sample-project');
    this.cli.printed('CLI');
  });

  it('displays deployment info', async function () {
    this.cli.printed('network: hardhat');
    this.cli.printed('deployment: deployments/hardhat/test');
  });

  it('displays usage help', async function () {
    this.cli.printed('USAGE:');
    this.cli.printed('Use arrows to navigate, or type to autocomplete');
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
