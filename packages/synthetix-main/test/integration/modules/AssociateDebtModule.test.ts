import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../bootstrap';

describe.only('AssociateDebtModule', function () {
  const {
    signers,
    systems,
    collateralAddress,
    collateralContract,
    poolId,
    accountId,
    MockMarket,
    marketId,
    depositAmount,
    restore,
  } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  describe('associateDebt()', () => {

    const amount = ethers.utils.parseEther('1');

    it('only works from the configured market address', async () => {
      await assertRevert(systems().Core.associateDebt(marketId, poolId, collateralAddress(), accountId, amount, { from: owner }));
    });

    it('only works when the market is actually included in the pool', async () => {
      await assertRevert(await MockMarket().callAssociateDebt(marketId, 828374, collateralAddress(), accountId, amount));
    });

    it('only works when the target account has enough collateral', async () => {
      await assertRevert(await MockMarket().callAssociateDebt(marketId, poolId, collateralAddress(), accountId, amount.mul(100000000)));
    });

    describe('with a second staker', async () => {

      const user2AccountId = 28374737562;

      // TODO: refactor this `before` into its own helper function, its so common
      before('new staker', async () => {
        // user1 has extra collateral available
        await collateralContract()
          .connect(user1)
          .transfer(await user2.getAddress(), depositAmount.mul(2));

        await systems().Core.connect(user2).createAccount(user2AccountId);

        await collateralContract()
          .connect(user2)
          .approve(systems().Core.address, depositAmount.mul(2));

        await systems()
          .Core.connect(user2)
          .depositCollateral(user2AccountId, collateralAddress(), depositAmount.mul(2));

        await systems().Core.connect(user2).delegateCollateral(
          user2AccountId,
          poolId,
          collateralAddress(),
          depositAmount.div(3), // user1 75%, user2 25%
          ethers.utils.parseEther('1')
        );
      });

      describe('when invoked', async () => {
        let prevMarketIssuance: ethers.BigNumber;
  
  
        before('record', async () => {
          prevMarketIssuance = await systems().Core.getMarketIssuance(marketId());
        });
  
        before('invoke', async () => {
          await MockMarket().callAssociateDebt(marketId(), poolId, collateralAddress(), user2AccountId, amount);
  
          assertBn.equal(await systems().SNX.balanceOf(await user1.getAddress()), amount);
        });
  
        it('reduces market issuance', async () => {
          assertBn.equal(
            await systems().Core.getMarketIssuance(marketId()), 
            prevMarketIssuance.sub(amount)
          );
        });
  
        it('increases user debt', async () => {
          assertBn.equal(
            await systems().Core.getPositionDebt(poolId, collateralAddress(), user2AccountId),
            amount
          );
        });
  
        it('keeps other user debt the same', async () => {
          // the mock market contract is programmed to not affect overall market debt during the operation,
          // which is usually what we would expect
          assertBn.equal(
            await systems().Core.getPositionDebt(poolId, collateralAddress(), accountId),
            0
          );
        });
      });
    });
  });
});
