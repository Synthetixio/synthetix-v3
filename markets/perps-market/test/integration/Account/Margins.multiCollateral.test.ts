import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { depositCollateral, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { calculatePricePnl } from '../helpers/fillPrice';
import { ethers } from 'ethers';

describe.only('Account margins - Multicollateral', () => {
  const accountId = 4;
  const perpsMarketConfig = [
    {
      requestedMarketId: 25,
      name: 'Bitcoin',
      token: 'BTC',
      price: bn(30_000),
      fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(1000),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 26,
      name: 'Ether',
      token: 'ETH',
      price: bn(2000),
      fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        minimumInitialMarginRatio: bn(0.01),
        maintenanceMarginScalar: bn(0.5),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
        minimumPositionMargin: bn(500),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
  ];

  const synthMarketsConfig = [
    {
      name: 'btc',
      token: 'snxBTC',
      buyPrice: bn(20_000),
      sellPrice: bn(20_000),
      skewScale: bn(100),
    },
    {
      name: 'eth',
      token: 'snxETH',
      buyPrice: bn(2_000),
      sellPrice: bn(2_000),
      skewScale: bn(10_000),
    },
  ];

  const { systems, provider, trader1, trader2, perpsMarkets, synthMarkets } = bootstrapMarkets({
    synthMarkets: synthMarketsConfig,
    perpsMarkets: perpsMarketConfig,
    traderAccountIds: [accountId, 5],
    liquidationGuards: {
      minLiquidationReward: bn(0),
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(10_000),
      maxKeeperScalingRatioD18: bn(1),
    },
  });

  before('deposit some snxETH and snxBTC', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => accountId,
      collaterals: [
        {
          synthMarket: () => synthMarkets()[0],
          snxUSDAmount: () => bn(240_000),
        },
        {
          synthMarket: () => synthMarkets()[1],
          snxUSDAmount: () => bn(1_400_000),
        },
      ],
    });

    await depositCollateral({
      systems,
      trader: trader2,
      accountId: () => 5,
      collaterals: [
        {
          synthMarket: () => synthMarkets()[0],
          snxUSDAmount: () => bn(16_000),
        },
        {
          synthMarket: () => synthMarkets()[1],
          snxUSDAmount: () => bn(20_000),
        },
      ],
    });

    it('has correct margin', async () => {
      console.log(await systems().PerpsMarket.getWithdrawableMargin(accountId));
      console.log(await systems().PerpsMarket.getAvailableMargin(accountId));
    });
  });
});
