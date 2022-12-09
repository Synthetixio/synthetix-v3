import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { snapshotCheckpoint } from '../../utils/snapshot';
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

    await systems().Core.connect(owner).setMinLiquidityRatio(One.mul(2));

    // ping to make sure ratio is applied on active position for read only calls
    await systems().Core.connect(owner).getPositionDebt(accountId, poolId, collateralAddress());
  });

  const restore = snapshotCheckpoint(provider);

  describe('getSystemMaxValuePerShare()', async () => {
    describe('when undelegated from pool', async () => {
      before(restore);
      before('undelegate', async () => {
        await systems()
          .Core.connect(user1)
          .delegateCollateral(
            accountId,
            poolId,
            collateralAddress(),
            0,
            ethers.utils.parseEther('1')
          );

        // sanity
        assertBn.equal(await systems().Core.Market_get_creditCapacityD18(marketId()), 0);
      });

      it('returns 0 for a pool with nothing delegated', async () => {
        assertBn.equal(
          await systems().Core.Pool_getSystemMaxValuePerShare(poolId, marketId(), 0, 0),
          0
        );
      });
    });

    describe('with usual staking position', async () => {
      before(restore);

      it('returns 0 with 0 unused credit capacity even if there are shares', async () => {
        assertBn.equal(
          await systems().Core.Pool_getSystemMaxValuePerShare(
            poolId,
            marketId(),
            depositAmount.div(2),
            0
          ),
          ethers.utils.parseEther('0.25')
        );
      });

      it('returns 50 with 100 unused credit capacity with shares multiplied', async () => {
        assertBn.equal(
          // multiply by deposit shares because we want 100 units of capacity per share
          await systems().Core.Pool_getSystemMaxValuePerShare(
            poolId,
            marketId(),
            depositAmount.div(2),
            0
          ),
          ethers.utils.parseEther('0.25')
        );
      });

      describe('change min liquidity ratio', async () => {
        before('change ratio', async () => {
          await systems().Core.connect(owner).setMinLiquidityRatio(ethers.utils.parseEther('4'));
        });

        it('returns even less available liquidity with same credit capacity query', async () => {
          assertBn.equal(
            // multiply by deposit shares because we want 100 units of capacity per share
            await systems().Core.Pool_getSystemMaxValuePerShare(
              poolId,
              marketId(),
              depositAmount.div(2),
              0
            ),
            ethers.utils.parseEther('0.125')
          );
        });
      });
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

      it('system max value per share returns same as the market', async () => {
        // debt per share should be increased because of the debt but the parameter
        // still shows same amount of max value pre share
        assertBn.equal(
          await systems().Core.Pool_getSystemMaxValuePerShare(poolId, marketId(), 0, 0),
          One.div(10)
        );
      });

      it('returns same credit capacity since limit has not been updated', async () => {
        assertBn.equal(
          await systems().Core.Pool_getSystemMaxValuePerShare(
            poolId,
            marketId(),
            depositAmount,
            await systems().Core.Pool_get_totalVaultDebtsD18(poolId)
          ),
          depositAmount.div(2).mul(One).div(depositAmount)
        );
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

        it('has more limit', async () => {
          assertBn.equal(
            await systems().Core.Pool_getSystemMaxValuePerShare(
              poolId,
              marketId(),
              depositAmount.mul(2),
              await systems().Core.Pool_get_totalVaultDebtsD18(poolId)
            ),
            One.div(100).mul(55) // value becomes 55 because there are more shares, but half of them have 0.1 attached to them
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
