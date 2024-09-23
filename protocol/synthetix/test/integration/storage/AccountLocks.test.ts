import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { bootstrapWithStakedPool } from '../bootstrap';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('AccountLocks', () => {
  const { systems, accountId, collateralAddress, provider, signers } = bootstrapWithStakedPool();

  let lockTime = 0;
  let collatInfo: { totalDeposited: ethers.BigNumber };

  let user1: ethers.Signer;

  before('identify signers', async () => {
    [user1] = signers();
  });

  before('create dummy locks', async () => {
    lockTime = await getTime(provider());
    collatInfo = await systems().Core.getAccountCollateral(accountId, collateralAddress());
    await systems()
      .Core.connect(user1)
      .createLock(
        accountId,
        collateralAddress(),
        collatInfo.totalDeposited.div(4),
        lockTime + 1000
      );

    await systems()
      .Core.connect(user1)
      .createLock(
        accountId,
        collateralAddress(),
        collatInfo.totalDeposited.div(8),
        lockTime + 2000
      );

    await systems()
      .Core.connect(user1)
      .createLock(
        accountId,
        collateralAddress(),
        collatInfo.totalDeposited.div(2),
        lockTime + 3000
      );
  });

  const restore = snapshotCheckpoint(provider);

  describe('cleanAccountLocks()', async function () {
    afterEach(restore);
    it('cleans nothing if there is nothing to clean', async () => {
      // nothing should have expired yet
      await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 0, 999);

      assert((await systems().Core.getLocks(accountId, collateralAddress(), 0, 999)).length === 3);
    });

    it('cleans in specified range', async () => {
      await fastForwardTo(lockTime + 2001, provider());

      await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 0, 999);

      assert((await systems().Core.getLocks(accountId, collateralAddress(), 0, 999)).length === 1);
    });

    describe('scaling', async () => {
      beforeEach('reduce user balance', async () => {
        const collatInfo2 = await systems().Core.getAccountCollateral(
          accountId,
          collateralAddress()
        );
        // should result in 50% scaling
        await systems().Core.Account_decreaseAvailableCollateral(
          accountId,
          collateralAddress(),
          collatInfo2.totalDeposited.sub(collatInfo2.totalLocked.div(2))
        );

        console.log(
          'collateral situation',
          await systems().Core.getAccountCollateral(accountId, collateralAddress())
        );
      });

      it('does not scale when it cannot', async () => {
        await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 1, 999);
        let locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 999);

        assertBn.equal(locks[0].amountD18, collatInfo.totalDeposited.div(4));
        assertBn.equal(locks[1].amountD18, collatInfo.totalDeposited.div(8));
        assertBn.equal(locks[2].amountD18, collatInfo.totalDeposited.div(2));

        await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 0, 2);
        locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 999);

        assertBn.equal(locks[0].amountD18, collatInfo.totalDeposited.div(4));
        assertBn.equal(locks[1].amountD18, collatInfo.totalDeposited.div(8));
        assertBn.equal(locks[2].amountD18, collatInfo.totalDeposited.div(2));
      });

      it('scales properly', async () => {
        await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 0, 3);
        const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 999);

        assertBn.equal(locks[0].amountD18, collatInfo.totalDeposited.div(4).div(2));
        assertBn.equal(locks[1].amountD18, collatInfo.totalDeposited.div(8).div(2));
        assertBn.equal(locks[2].amountD18, collatInfo.totalDeposited.div(2).div(2));
      });

      it('scales if len set to 0', async () => {
        // setting length to 0 means to iterate forever
        await systems().Core.Account_cleanAccountLocks(accountId, collateralAddress(), 0, 0);
        const locks = await systems().Core.getLocks(accountId, collateralAddress(), 0, 999);

        assertBn.equal(locks[0].amountD18, collatInfo.totalDeposited.div(4).div(2));
        assertBn.equal(locks[1].amountD18, collatInfo.totalDeposited.div(8).div(2));
        assertBn.equal(locks[2].amountD18, collatInfo.totalDeposited.div(2).div(2));
      });
    });
  });
});
