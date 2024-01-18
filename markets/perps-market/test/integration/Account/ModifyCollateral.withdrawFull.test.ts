import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('ModifyCollateral Withdraw Deposit/Withdraw', () => {
  const accountIds = [10];

  const { systems, trader1 } = bootstrapMarkets({
    liquidationGuards: {
      minLiquidationReward: bn(1),
      minKeeperProfitRatioD18: bn(1),
      maxLiquidationReward: bn(1),
      maxKeeperScalingRatioD18: bn(1),
    },
    synthMarkets: [],
    perpsMarkets: [],
    traderAccountIds: accountIds,
  });

  describe('deposit and withdraw fully', () => {
    before('deposit collateral', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(10, 0, bn(1500));
    });

    it('should show full withdrawable margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getWithdrawableMargin(10), bn(1500));
    });

    it('should withdraw fully', async () => {
      const traderAmountBefore = await systems().USD.balanceOf(await trader1().getAddress());
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(10, 0, bn(-1500));

      assertBn.equal(
        await systems().USD.balanceOf(await trader1().getAddress()),
        traderAmountBefore.add(bn(1500))
      );
    });
  });
});
