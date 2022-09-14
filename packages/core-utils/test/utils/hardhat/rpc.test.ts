import assert from 'assert/strict';

import {
  advanceBlock,
  fastForward,
  fastForwardTo,
  getBlock,
  getTime,
  restoreSnapshot,
  takeSnapshot,
} from '../../../src/utils/hardhat/rpc';

// TODO: catch 22 because for some reason the `declares.d.ts` in the
// helpers dir is doing nothing to help us here
// and declaring the module specifically here does nothing either
// if we install `@types/sinon` there seems to be a bug internal
// to the lib that causes regular build to fail
// so we have to require
const sinon = require('sinon'); // eslint-disable-line

const fakeProvider = {
  async send() {
    return 42;
  },

  async getBlock() {
    return { timestamp: 1337, number: 42 };
  },
};

describe('utils/hardhat/rpc.ts', function () {
  const provider = sinon.spy(fakeProvider);

  describe('when taking a snapshot', function () {
    let snapshotId: string;

    before('clear spy history', function () {
      provider.send.resetHistory();
    });

    before('call createSnapshot', async function () {
      snapshotId = await takeSnapshot(provider);
    });

    it('returns the snapshotId', function () {
      assert.equal(snapshotId, 42);
    });

    it('calls the provider.send twice', function () {
      assert(provider.send.calledTwice);
    });

    it('calls the provider.send with the right params', function () {
      assert.equal(provider.send.getCall(0).args[0], 'evm_snapshot');
      assert.deepEqual(provider.send.getCall(0).args[1], []);

      assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
    });

    describe('when restoring a snapshot', function () {
      before('call restoreSnapshot', async function () {
        await restoreSnapshot(snapshotId, provider);
      });

      it('calls the provider.send twice', function () {
        assert.equal(provider.send.callCount, 4);
      });

      it('calls the provider.send with the right params', function () {
        assert.equal(provider.send.getCall(2).args[0], 'evm_revert');
        assert.deepEqual(provider.send.getCall(2).args[1], [snapshotId]);

        assert.equal(provider.send.getCall(3).args[0], 'evm_mine');
      });
    });
  });

  describe('when calling fastForward', function () {
    before('clear spy history', function () {
      provider.send.resetHistory();
    });

    before('call fastForward', async function () {
      await fastForward(1337, provider);
    });

    it('calls the provider.send twice', function () {
      assert(provider.send.calledTwice);
    });

    it('calls the provider.send with the right params', function () {
      assert.equal(provider.send.getCall(0).args[0], 'evm_increaseTime');
      assert.deepEqual(provider.send.getCall(0).args[1], [1337]);

      assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
    });
  });

  describe('when calling fastForwardTo', function () {
    describe('to the future', function () {
      before('clear spy history', function () {
        provider.send.resetHistory();
      });

      before('call fastForward', async function () {
        await fastForwardTo(10000, provider);
      });

      it('calls the provider.send twice', function () {
        assert(provider.send.calledTwice);
      });

      it('calls the provider.send with the right params', function () {
        assert.equal(provider.send.getCall(0).args[0], 'evm_setNextBlockTimestamp');
        assert.deepEqual(provider.send.getCall(0).args[1], [10000]);

        assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
      });
    });
  });

  describe('when calling advanceBlock', function () {
    before('clear spy history', function () {
      provider.send.resetHistory();
    });

    before('call advanceBlock', async function () {
      await advanceBlock(provider);
    });

    it('calls the provider.send once', function () {
      assert(provider.send.calledOnce);
    });

    it('calls the provider.send with the right params', function () {
      assert.equal(provider.send.getCall(0).args[0], 'evm_mine');
    });
  });

  describe('when calling getBlock', function () {
    it('returns the expected value', async function () {
      assert.equal(await getBlock(provider), 42);
    });
  });

  describe('when calling getTime', function () {
    it('returns the expected value', async function () {
      assert.equal(await getTime(provider), 1337);
    });
  });
});
