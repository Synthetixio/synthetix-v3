import { bootstrapMarkets } from './bootstrap';
import { _SECONDS_IN_DAY } from './helpers';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { ethers } from 'ethers';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

const _ETH_PRICE = wei(2000);
const _ETH_LOCKED_OI_RATIO = wei(1);

const interestRateParams = {
  lowUtilGradient: wei(0.0003),
  gradientBreakpoint: wei(0.75),
  highUtilGradient: wei(0.01),
};

describe('Delegation test', () => {
  const accountId = 1;
  const { systems, provider, staker, poolId } = bootstrapMarkets({
    interestRateParams: {
      lowUtilGradient: interestRateParams.lowUtilGradient.toBN(),
      gradientBreakpoint: interestRateParams.gradientBreakpoint.toBN(),
      highUtilGradient: interestRateParams.highUtilGradient.toBN(),
    },
    synthMarkets: [],
    perpsMarkets: [
      {
        lockedOiRatioD18: _ETH_LOCKED_OI_RATIO.toBN(),
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE.toBN(),
      },
    ],
    traderAccountIds: [2],
  });

  const restore = snapshotCheckpoint(provider);

  describe('market min delegation time set properly and can be updated', async () => {
    it('undelegates 10% correctly', async () => {
      await fastForwardTo((await getTime(provider())) + _SECONDS_IN_DAY + 10, provider());
      const currentCollateralAmount = await systems().Core.getPositionCollateral(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      // very low amount to make market insolvent
      await systems()
        .Core.connect(staker())
        .delegateCollateral(
          accountId,
          poolId,
          systems().CollateralMock.address,
          wei(currentCollateralAmount).mul(wei(0.9)).toBN(),
          ethers.utils.parseEther('1')
        );
      const postCollateralAmount = await systems().Core.getPositionCollateral(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      assert.ok(postCollateralAmount.lt(currentCollateralAmount));
    });

    it('errors on undelegate because the min delegation time has not passed', async () => {
      const currentCollateralAmount = await systems().Core.getPositionCollateral(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      const minAccountDelegationTime = await systems().Core.getAccountMinDelegateTime(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      const blockTimestamp = await getTime(provider());
      // this will cause the next call to revert if true
      assert.ok(minAccountDelegationTime.gt(blockTimestamp));
      await assertRevert(
        systems()
          .Core.connect(staker())
          .delegateCollateral(
            accountId,
            poolId,
            systems().CollateralMock.address,
            wei(currentCollateralAmount).mul(wei(0.9)).toBN(),
            ethers.utils.parseEther('1')
          ),
        'MinDelegationTimeoutPending'
      );
    });

    it('succeeds because the min delegation time has passed', async () => {
      await fastForwardTo((await getTime(provider())) + _SECONDS_IN_DAY * 10, provider());
      const currentCollateralAmount = await systems().Core.getPositionCollateral(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      await systems()
        .Core.connect(staker())
        .delegateCollateral(
          accountId,
          poolId,
          systems().CollateralMock.address,
          wei(currentCollateralAmount).mul(wei(0.9)).toBN(),
          ethers.utils.parseEther('1')
        );
      const currentCollateralAmountAfter = await systems().Core.getPositionCollateral(
        accountId,
        poolId,
        systems().CollateralMock.address
      );
      assert.ok(currentCollateralAmountAfter.lt(currentCollateralAmount));
    });
  });
  after(restore);
});
