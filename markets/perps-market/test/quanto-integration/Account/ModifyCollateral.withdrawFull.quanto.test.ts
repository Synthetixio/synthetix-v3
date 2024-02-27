import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../../integration/bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('ModifyCollateral Withdraw Deposit/Withdraw', () => {
  // Account and Market Identifiers
  const accountIds = [10];
  const btcMarketId = 25;
  const quantoSynthMarketIndex = 0;

  // Market Prices
  const btcPrice = bn(30_000);
  const ethPrice = bn(2_000);

  // Skew Scales
  const btcSkewScale = bn(100).div(2000);

  // Margin and Funding Parameters
  const maxFundingVelocity = bn(0);
  const initialMarginFraction = bn(2);
  const minimumInitialMarginRatio = bn(0.01);
  const maintenanceMarginScalar = bn(0.5);
  const maxLiquidationLimitAccumulationMultiplier = bn(1);
  const liquidationRewardRatio = bn(0.05);
  const maxSecondsInLiquidationWindow = ethers.BigNumber.from(10);

  // Position Margins
  const btcMinimumPositionMargin = bn(1000);

  // Liquidation Parameters
  const settlementReward = bn(0);

  const perpsMarketConfig = [
    {
      requestedMarketId: btcMarketId,
      name: 'Bitcoin',
      token: 'BTC',
      price: btcPrice,
      fundingParams: { skewScale: btcSkewScale, maxFundingVelocity: maxFundingVelocity },
      liquidationParams: {
        initialMarginFraction: initialMarginFraction,
        minimumInitialMarginRatio: minimumInitialMarginRatio,
        maintenanceMarginScalar: maintenanceMarginScalar,
        maxLiquidationLimitAccumulationMultiplier: maxLiquidationLimitAccumulationMultiplier,
        liquidationRewardRatio: liquidationRewardRatio,
        maxSecondsInLiquidationWindow: maxSecondsInLiquidationWindow,
        minimumPositionMargin: btcMinimumPositionMargin,
      },
      settlementStrategy: {
        settlementReward: settlementReward,
      },
      quanto: {
        name: 'Ether',
        token: 'ETH',
        price: ethPrice,
        quantoSynthMarketIndex: quantoSynthMarketIndex,
      },
    },
  ];

  // Spot Market Config
  const spotMarketConfig = [
    {
      name: 'Ether',
      token: 'snxETH',
      buyPrice: ethPrice,
      sellPrice: ethPrice,
    },
  ];

  const { systems, trader1 } = bootstrapMarkets({
    liquidationGuards: {
      minLiquidationReward: bn(1),
      minKeeperProfitRatioD18: bn(1),
      maxLiquidationReward: bn(1),
      maxKeeperScalingRatioD18: bn(1),
    },
    synthMarkets: spotMarketConfig,
    perpsMarkets: perpsMarketConfig,
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
