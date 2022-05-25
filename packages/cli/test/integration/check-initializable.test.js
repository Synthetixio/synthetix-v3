const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('check-initializable', function () {
  bootstrap();

  before('use the cli', async function () {
    this.timeout(60000);

    await this.cli.start();
    await this.cli.interact('InitializableModule'); // Filter InitializableModule
    await this.cli.interact(this.cli.keys.ENTER); // Selects InitializableModule
    await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
    await this.cli.interact(this.cli.keys.CTRLC); // Exit

    assert.deepEqual(this.cli.errors, []);
  });

  it('displays the contract not initialized warning', async function () {
    this.cli.printed(
      'Contract initializable but not initialized. Call initializeInitializableModule() with the right paramters first'
    );
  });
});
