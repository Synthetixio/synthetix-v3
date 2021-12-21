const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('print-info', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  it('displays the project name and title', async function () {
    this.cli.printed('sample-project');
    this.cli.printed('CLI');
  });

  it('displays deployment info', async function () {
    this.cli.printed('instance: test');
    this.cli.printed('signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    this.cli.printed('network: local');
    this.cli.printed('deployment: deployments/local/test');
  });

  it('displays usage help', async function () {
    this.cli.printed('USAGE:');
    this.cli.printed('Use arrows to navigate, or type to autocomplete');
  });
});
