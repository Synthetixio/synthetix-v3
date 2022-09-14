const { equal } = require('assert/strict');
const { getFullFunctionSignature, getFullEventSignature } = require('../../../internal/signatures');
const sampleFunctionAbi = require('../../fixtures/abis/sample-function-abi');
const sampleEventAbi = require('../../fixtures/abis/sample-event-abi');
const sampleEventReceipt = require('../../fixtures/abis/sample-event-receipt');

describe('internal/signatures.js', function () {
  let str;

  describe('full function signatures', () => {
    describe('without parameter values', () => {
      before('produce the signature', async () => {
        str = getFullFunctionSignature(sampleFunctionAbi);
      });

      it('produces the expected string', async () => {
        equal(
          str,
          'createSynth(bytes32 synth, string synthName, string synthSymbol, uint8 synthDecimals)'
        );
      });
    });

    describe('with parameter values', () => {
      before('produce the signature', async () => {
        str = getFullFunctionSignature(sampleFunctionAbi, [
          '0x7355534400000000000000000000000000000000000000000000000000000000',
          'Synthetic USD',
          'sUSD',
          18,
        ]);
      });

      it('produces the expected string', async () => {
        equal(
          str,
          `createSynth(
  bytes32 synth = 0x7355534400000000000000000000000000000000000000000000000000000000,
  string synthName = Synthetic USD,
  string synthSymbol = sUSD,
  uint8 synthDecimals = 18
)`
        );
      });
    });
  });

  describe('full event signatures', () => {
    before('produce the signature', async () => {
      str = getFullEventSignature(sampleEventAbi, sampleEventReceipt);
    });

    it('produces the expected string', async () => {
      equal(
        str,
        `SynthImplementationCreated(
  address implementationAddress = 0x8EFa1819Ff5B279077368d44B593a4543280e402
)`
      );
    });
  });
});
