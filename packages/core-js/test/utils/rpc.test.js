const assert = require('assert/strict');
const sinon = require('sinon');
const { takeSnapshot, restoreSnapshot } = require('../../utils/rpc');

const fakeProvider = {
  send() {
    return new Promise((resolve) => {
      resolve(42);
    });
  },
};

describe('utils/rpc.js', () => {
  let provider;

  before(function () {
    provider = sinon.spy(fakeProvider);
  });

  describe('when taking a snapshot', () => {
    let snapshotId;

    before('call createSnapshot', async () => {
      console.log(provider);
      snapshotId = await takeSnapshot(provider);
    });

    it('returns the snapshotId', () => {
      assert.equal(snapshotId, 42);
    });

    it('calls the provider.send twice', () => {
      assert(provider.send.calledTwice);
    });

    it('calls the provider.send with the right params', () => {
      assert.equal(provider.send.getCall(0).args[0], 'evm_snapshot');
      assert.deepEqual(provider.send.getCall(0).args[1], []);

      assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
      assert.equal(provider.send.getCall(1).args[1], undefined);
    });

    describe('when restoring a snapshot', () => {
      before('call restoreSnapshot', async () => {
        await restoreSnapshot(snapshotId, provider);
      });

      it('calls the provider.send twice', () => {
        assert.equal(provider.send.callCount, 4);
      });

      it('calls the provider.send with the right params', () => {
        assert.equal(provider.send.getCall(2).args[0], 'evm_revert');
        assert.deepEqual(provider.send.getCall(2).args[1], [snapshotId]);

        assert.equal(provider.send.getCall(3).args[0], 'evm_mine');
        assert.equal(provider.send.getCall(3).args[1], undefined);
      });
    });
  });
});
