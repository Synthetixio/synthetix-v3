const assert = require('assert/strict');
const sinon = require('sinon');
const {
  takeSnapshot,
  restoreSnapshot,
  fastForward,
  fastForwardTo,
  getTime,
} = require('../../../utils/hardhat/rpc');

const fakeProvider = {
  async send() {
    return 42;
  },

  async getBlock() {
    return { timestamp: 1337 };
  },
};

describe('utils/hardhat/rpc.js', () => {
  let provider;

  before(function () {
    provider = sinon.spy(fakeProvider);
  });

  describe('when taking a snapshot', () => {
    let snapshotId;

    before('clear spy history', () => {
      provider.send.resetHistory();
    });

    before('call createSnapshot', async () => {
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

  describe('when calling fastForward', () => {
    before('clear spy history', () => {
      provider.send.resetHistory();
    });

    before('call fastForward', async () => {
      await fastForward(1337, provider);
    });

    it('calls the provider.send twice', () => {
      assert(provider.send.calledTwice);
    });

    it('calls the provider.send with the right params', () => {
      assert.equal(provider.send.getCall(0).args[0], 'evm_increaseTime');
      assert.deepEqual(provider.send.getCall(0).args[1], [1337]);

      assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
      assert.equal(provider.send.getCall(1).args[1], undefined);
    });
  });

  describe('when calling fastForwardTo', () => {
    describe('to the past', function () {
      it('throws', async function () {
        try {
          await fastForwardTo(1000, provider);
        } catch (err) {
          assert.ok(err.toString().includes('Cannot fast forward to a past date'));
        }
      });
    });

    describe('to the future', function () {
      before('clear spy history', () => {
        provider.send.resetHistory();
      });

      before('call fastForward', async () => {
        await fastForwardTo(10000, provider);
      });

      it('calls the provider.send twice', () => {
        assert(provider.send.calledTwice);
      });

      it('calls the provider.send with the right params', () => {
        assert.equal(provider.send.getCall(0).args[0], 'evm_increaseTime');
        assert.deepEqual(provider.send.getCall(0).args[1], [10000 - 1337]);

        assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
        assert.equal(provider.send.getCall(1).args[1], undefined);
      });
    });
  });

  describe('when calling getTime', () => {
    it('returns the expected value', async () => {
      assert.equal(await getTime(provider), 1337);
    });
  });
});
