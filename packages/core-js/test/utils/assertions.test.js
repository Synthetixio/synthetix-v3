const { rejects } = require('assert/strict');
const { assertRevert } = require('../../utils/assertions');

function mockValidTx() {
  return Promise.resolve({ wait: () => Promise.resolve() });
}

describe('utils/assertions.js', function () {
  describe('#assertRevert', function () {
    it('rejects when not reverting', async function () {
      await rejects(
        async () => {
          await assertRevert(mockValidTx(), 'Some message');
        },
        {
          message: 'Transaction was expected to revert, but it did not',
        }
      );
    });
  });
});
