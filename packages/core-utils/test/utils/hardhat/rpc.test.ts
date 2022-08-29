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

describe('utils/hardhat/rpc.js', () => {
  let provider: any;

  before(function () {
    provider = sinon.spy(fakeProvider);
  });

  describe('when taking a snapshot', () => {
    let snapshotId: any;

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
      console.log(provider.send.getCall(0).args);
      assert.equal(provider.send.getCall(0).args[0], 'evm_snapshot');
      assert.deepEqual(provider.send.getCall(0).args[1], []);

      assert.equal(provider.send.getCall(1).args[0], 'evm_mine');
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
    });
  });

  describe('when calling fastForwardTo', () => {
    describe('to the past', function () {
      it('throws', async function () {
        try {
          await fastForwardTo(1000, provider);
        } catch (err) {
          assert.ok((err as Error).toString().includes('Cannot fast forward to a past date'));
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
      });
    });
  });

  describe('when calling advanceBlock', () => {
    before('clear spy history', () => {
      provider.send.resetHistory();
    });

    before('call advanceBlock', async () => {
      await advanceBlock(provider);
    });

    it('calls the provider.send once', () => {
      assert(provider.send.calledOnce);
    });

    it('calls the provider.send with the right params', () => {
      assert.equal(provider.send.getCall(0).args[0], 'evm_mine');
    });
  });

  describe('when calling getBlock', () => {
    it('returns the expected value', async () => {
      assert.equal(await getBlock(provider), 42);
    });
  });

  describe('when calling getTime', () => {
    it('returns the expected value', async () => {
      assert.equal(await getTime(provider), 1337);
    });
  });
});
