import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { ContractTransaction, Signer } from 'ethers';
import { bootstrapWithStakedPool } from '../../../bootstrap';

describe('CollateralModule', function () {
  const { signers, systems, provider, accountId, collateralAddress, depositAmount } =
    bootstrapWithStakedPool();

  let user1: Signer;
  let user2: Signer;

  before('identify signers', async () => {
    [, user1, user2] = signers();
  });

  const restore = snapshotCheckpoint(provider);

  describe('createLock()', function () {
    before(restore);
    it('can only be called by owner or user', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .createLock(1, collateralAddress(), depositAmount.div(10), 1234123412341),
        'PermissionDenied(',
        systems().Core
      );
    });

    it('fails when expire time is in the past', async () => {
      await assertRevert(
        systems().Core.connect(user1).createLock(
          1,
          collateralAddress(),
          depositAmount.div(10),
          1 // timestamp is definitely in the past
        ),
        'InvalidParameter("expireTimestamp"',
        systems().Core
      );
    });

    it('fails when insufficient collateral in account to lock', async () => {
      await assertRevert(
        systems().Core.connect(user1).createLock(
          1,
          collateralAddress(),
          0, // 0 is invalid for amount to lock
          1234123412341
        ),
        'InvalidParameter("amount", "must be nonzero")',
        systems().Core
      );
    });

    it('fails when insufficient collateral in account to lock', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .createLock(1, collateralAddress(), depositAmount.mul(1000).add(1), 1234123412341),
        'InsufficientAccountCollateral(',
        systems().Core
      );
    });

    describe('successful invoke', async () => {
      let txn: ContractTransaction;
      before('invoked', async () => {
        txn = await systems()
          .Core.connect(user1)
          .createLock(1, collateralAddress(), depositAmount.div(10), 1234123412341);

        // create a second one also
        await systems()
          .Core.connect(user1)
          .createLock(1, collateralAddress(), depositAmount.div(10).mul(4), 1234123412342);
      });

      it('increments account locked amount', async () => {
        assertBn.equal(
          (await systems().Core.getAccountCollateral(accountId, collateralAddress()))[2],
          depositAmount.div(2)
        );
      });

      it('created locks with the given specification', async () => {
        const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 0);
        assert(locks.length === 2);
        assertBn.equal(locks[0].amountD18, depositAmount.div(10));
        assertBn.equal(locks[0].lockExpirationTime, 1234123412341);
        assertBn.equal(locks[1].amountD18, depositAmount.div(10).mul(4));
        assertBn.equal(locks[1].lockExpirationTime, 1234123412342);
      });

      it('emits event', async () => {
        await assertEvent(
          txn,
          `CollateralLockCreated(${accountId}, "${collateralAddress()}", ${depositAmount
            .div(10)
            .toString()}, 1234123412341)`,
          systems().Core
        );
      });
    });
  });

  describe('cleanExpiredLocks()', function () {
    before(restore);

    let ts: number;

    before('create locks', async () => {
      ts = await getTime(provider());
      await systems()
        .Core.connect(user1)
        .createLock(1, collateralAddress(), depositAmount.div(10), ts + 200);
      await systems()
        .Core.connect(user1)
        .createLock(1, collateralAddress(), depositAmount.div(10), ts + 400);
      await systems()
        .Core.connect(user1)
        .createLock(1, collateralAddress(), depositAmount.div(10), ts + 300);
      await systems()
        .Core.connect(user1)
        .createLock(1, collateralAddress(), depositAmount.div(10), ts + 100);

      await fastForwardTo(ts + 300, provider());
    });

    const cleanRestore = snapshotCheckpoint(provider);

    describe('invoke on the whole thing', async () => {
      let txn: ContractTransaction;
      before(cleanRestore);
      before('clean', async () => {
        txn = await systems()
          .Core.connect(user1)
          .cleanExpiredLocks(accountId, collateralAddress(), 0, 0);
      });

      it('only has the one unexpired lock remaining', async () => {
        const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 0);
        assert(locks.length === 1);
      });

      it('emits event', async () => {
        await assertEvent(
          txn,
          `CollateralLockExpired(${accountId}, "${collateralAddress()}", ${depositAmount
            .div(10)
            .toString()}, ${ts + 200})`,
          systems().Core
        );
      });
    });

    describe('invoke on a portion', async () => {
      before(cleanRestore);
      before('clean', async () => {
        await systems().Core.connect(user1).cleanExpiredLocks(accountId, collateralAddress(), 1, 2);
      });

      it('only one expired lock could be removed', async () => {
        const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 0);
        assert(locks.length === 3);
      });

      describe('partial remove from off the end', async () => {
        before('clean', async () => {
          await systems()
            .Core.connect(user1)
            .cleanExpiredLocks(accountId, collateralAddress(), 1, 10000);
        });

        it('only one additional expired lock could be removed', async () => {
          const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 0);
          assert(locks.length === 2);
        });
      });
    });
  });
});
