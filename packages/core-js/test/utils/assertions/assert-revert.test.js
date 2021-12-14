const { rejects } = require('assert/strict');
const assertRevert = require('../../../utils/assertions/assert-revert');

function mockValidTx() {
  return Promise.resolve({ wait: () => Promise.resolve() });
}

function mockRevertingTx(errorMsg = '') {
  return Promise.resolve({ wait: () => Promise.reject(new Error(errorMsg)) });
}

describe('utils/assertions/assert-revert.js', function () {
  describe('#assertRevert', function () {
    it('resolves when correctly reverting', async function () {
      await assertRevert(mockRevertingTx(), '');
    });

    it('resolves when correctly reverting with a message', async function () {
      const message = 'The transaction reverted reversely';
      await assertRevert(mockRevertingTx(message), message);
    });

    it('rejects when not reverting', async function () {
      await rejects(async () => {
        await assertRevert(mockValidTx(), 'Some message');
      }, new Error('Transaction was expected to revert, but it did not'));
    });

    it('rejects when throwing an unknown error', async function () {
      const message = 'Unknown transaction error';
      const expectedMessage = 'The expected transaction error';

      await rejects(async () => {
        await assertRevert(mockRevertingTx(message), expectedMessage);
      }, new Error(`Transaction was expected to revert with "${expectedMessage}", but reverted with "Error: ${message}"`));
    });
  });
});
