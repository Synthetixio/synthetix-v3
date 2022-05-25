const assert = require('assert/strict');
const bootstrap = require('./helpers/bootstrap');

describe('execute-call', function () {
  bootstrap();

  describe('when calling setUintValue', function () {
    before('use the cli', async function () {
      this.timeout(60000);

      await this.cli.start();
      await this.cli.interact('SomeModule'); // Filter SomeModule
      await this.cli.interact(this.cli.keys.ENTER); // Selects SomeModule
      await this.cli.interact('setUintValue'); // Highlights setUintValue
      await this.cli.interact(this.cli.keys.ENTER); // Selects setUintValue
      await this.cli.interact('42'); // Input for "newValue"
      await this.cli.interact(this.cli.keys.ENTER); // Submits input
      await this.cli.interact(this.cli.keys.ENTER); // Confirms input
    });

    it('displays calldata', async function () {
      await this.cli.printed(
        'Calldata: 0x2f3b21a2000000000000000000000000000000000000000000000000000000000000002a'
      );
    });

    it('displays signer address', async function () {
      await this.cli.printed('Signer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('shows write warning', async function () {
      await this.cli.printed('This is a write transaction!');
    });

    it('shows gas estimation', async function () {
      await this.cli.printed('Estimated gas: ');
    });

    it('prints the tx hash', async function () {
      await this.cli.printed('Sending transaction with hash');
    });

    it('shows that the tx succeeded', async function () {
      await this.cli.printed('Transaction succeeded');
    });

    it('displays emitted events', async function () {
      await this.cli.printed('(1) events emitted:');
      await this.cli.printed('UintValueSet(');
      await this.cli.printed('address sender = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,');
      await this.cli.printed('uint256 value = 42');
      await this.cli.printed(')');
    });

    describe('when calling getUintValue', function () {
      before('use the cli', async function () {
        this.timeout(60000);

        // CLI is still running at this point...

        await this.cli.interact('getUintValue');
        await this.cli.interact(this.cli.keys.ENTER); // Selects getUintValue
        await this.cli.interact(this.cli.keys.CTRLC); // Return to function list
        await this.cli.interact(this.cli.keys.CTRLC); // Return to contract list
        await this.cli.interact(this.cli.keys.CTRLC); // Exit

        assert.deepEqual(this.cli.errors, []);
      });

      it('displays the function to be called', async function () {
        this.cli.printed('! Calling contracts/modules/SomeModule.sol:SomeModule.getUintValue()');
      });

      it('displays the calldata', async function () {
        this.cli.printed('Calldata: 0x55ec6354');
      });

      it('displays the returned value', async function () {
        this.cli.printed('42');
      });
    });
  });
});
