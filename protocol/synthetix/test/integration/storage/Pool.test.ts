import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';
import { bootstrapWithMockMarketAndPool } from '../bootstrap';

describe('Pool', function () {
  const {
    systems,
    provider,
    signers,
    marketId,
    poolId,
    accountId,
    MockMarket,
    depositAmount,
    collateralAddress,
  } = bootstrapWithMockMarketAndPool();

  const One = ethers.utils.parseEther('1');

  let owner: ethers.Signer, user1: ethers.Signer;

  const secondaryPoolId = 9877;

  before('init', async () => {
    [owner, user1] = signers();

    // create a secondary pool for testing cases of having multiple pools for one market
    await systems()
      .Core.connect(owner)
      .createPool(secondaryPoolId, await owner.getAddress());

    await systems()
      .Core.connect(owner)
      .setPoolConfiguration(secondaryPoolId, [
        {
          marketId: marketId(),
          weightD18: 1,
          maxDebtShareValueD18: ethers.utils.parseEther('10000'),
        },
      ]);

    await systems().Core.connect(owner)['setMinLiquidityRatio(uint256)'](One.mul(2));

    // ping to make sure ratio is applied on active position for read only calls
    await systems().Core.connect(owner).getPositionDebt(accountId, poolId, collateralAddress());
  });

  const restore = snapshotCheckpoint(provider);

  describe('getSystemMaxValuePerShare()', async () => {
    it('returns limit based on the min liquidity ratio', async () => {
      assertBn.equal(
        await systems().Core.Pool_getSystemMaxValuePerShare(0, marketId(), One.mul(2), 0),
        One.div(2)
      );
    });

    it('subtracts debt from the max debt per share', async () => {
      assertBn.equal(
        await systems().Core.Pool_getSystemMaxValuePerShare(0, marketId(), One.mul(2), One.div(10)),
        ethers.utils.parseEther('0.4')
      );
    });
  });

  describe('recalculateVaultCollateral()', async () => {
    before(restore);

    let initialMarketCapacity: ethers.BigNumber;

    before('save market capacity', async () => {
      initialMarketCapacity = await systems().Core.Market_get_creditCapacityD18(marketId());
    });

    it('recalculates nothing when vault is empty', async () => {
      await systems()
        .Core.connect(owner)
        .Pool_recalculateVaultCollateral(poolId, collateralAddress());
    });

    describe('market debt goes up', async () => {
      before('increase market debt', async () => {
        await MockMarket().connect(owner).setReportedDebt(depositAmount.div(10));

        // call this function to trigger downstream debts
        assertBn.equal(
          await systems()
            .Core.connect(owner)
            .callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
          depositAmount.div(10)
        );

        await systems().Core.connect(owner).getPositionDebt(accountId, poolId, collateralAddress());
      });

      it('the ultimate capacity of the market ends up to be the same', async () => {
        assertBn.equal(
          await systems().Core.Market_get_creditCapacityD18(marketId()),
          initialMarketCapacity
        );
      });

      describe('when more collateral is added', async () => {
        before('increase collateral', async () => {
          await systems()
            .Core.connect(user1)
            .delegateCollateral(
              accountId,
              poolId,
              collateralAddress(),
              depositAmount.mul(2),
              ethers.utils.parseEther('1')
            );
        });

        it('the ultimate capacity of the pool ends up higher', async () => {
          assertBn.gt(
            await systems().Core.Market_get_creditCapacityD18(marketId()),
            initialMarketCapacity
          );
        });
      });
    });
  });
});
