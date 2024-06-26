import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

const perpsMarketConfigs = [
  {
    requestedMarketId: 51,
    name: 'Ether',
    token: 'ETH',
    price: bn(2000),
    fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
    liquidationParams: {
      initialMarginFraction: bn(2),
      minimumInitialMarginRatio: bn(0.01),
      maintenanceMarginScalar: bn(0.5),
      maxLiquidationLimitAccumulationMultiplier: bn(1),
      liquidationRewardRatio: bn(0.02),
      maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
      minimumPositionMargin: bn(0),
    },
    settlementStrategy: {
      settlementReward: bn(0),
    },
  },
  {
    requestedMarketId: 52,
    name: 'snx',
    token: 'SNX',
    price: bn(10),
    fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
    liquidationParams: {
      initialMarginFraction: bn(2),
      minimumInitialMarginRatio: bn(0.01),
      maintenanceMarginScalar: bn(0.5),
      maxLiquidationLimitAccumulationMultiplier: bn(1),
      liquidationRewardRatio: bn(0.05),
      maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
      minimumPositionMargin: bn(0),
    },
    settlementStrategy: {
      settlementReward: bn(0),
    },
  },
];

const btcDiscountConfig = {
  upperLimitDiscount: bn(0.08),
  lowerLimitDiscount: bn(0.03),
  discountScalar: bn(2),
  skewScale: bn(100),
};

const ethDiscountConfig = {
  upperLimitDiscount: bn(0.04),
  lowerLimitDiscount: bn(0.02),
  discountScalar: bn(3),
  skewScale: bn(10_000),
};

const KeeperCosts = {
  settlementCost: bn(10),
  flagCost: bn(20),
  liquidateCost: bn(15),
};

const MIN_LIQ_REWARD = bn(10);

describe('liquidation margin only', () => {
  const {
    systems,
    provider,
    owner,
    trader1,
    synthMarkets,
    keeper,
    keeperCostOracleNode,
    perpsMarkets,
    superMarketId,
  } = bootstrapMarkets({
    liquidationGuards: {
      minLiquidationReward: MIN_LIQ_REWARD,
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(1000),
      maxKeeperScalingRatioD18: bn(0.5),
    },
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(30_000),
        sellPrice: bn(30_000),
        ...btcDiscountConfig,
      },
      {
        name: 'Ethereum',
        token: 'snxETH',
        buyPrice: bn(2000),
        sellPrice: bn(2000),
        ...ethDiscountConfig,
      },
    ],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2],
  });

  let btcSynth: SynthMarkets[number], ethSynth: SynthMarkets[number];
  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
  >;

  before('set keeper costs', async () => {
    await keeperCostOracleNode()
      .connect(owner())
      .setCosts(KeeperCosts.settlementCost, KeeperCosts.flagCost, KeeperCosts.liquidateCost);
  });

  before('add collateral to margin', async () => {
    btcSynth = synthMarkets()[0];
    ethSynth = synthMarkets()[1];

    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          synthMarket: () => btcSynth,
          snxUSDAmount: () => bn(30_000),
        },
        {
          synthMarket: () => ethSynth,
          snxUSDAmount: () => bn(15_000),
        },
        {
          snxUSDAmount: () => bn(2_000),
        },
      ],
    });
  });
  before('open positions', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: trader1(),
    };

    const positionSizes = [
      bn(50), // eth long
      bn(2000), // link long
    ];

    for (const [i, perpsMarket] of perpsMarkets().entries()) {
      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarket.marketId(),
        sizeDelta: positionSizes[i],
        settlementStrategyId: perpsMarket.strategyId(),
        price: perpsMarketConfigs[i].price,
      });
    }
  });

  it('should not be eligible for liquidation', async () => {
    // is not eligible for liquidation
    await assertRevert(
      systems().PerpsMarket.connect(keeper()).liquidate(2),
      'NotEligibleForLiquidation'
    );

    await assertRevert(
      systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2),
      'AccountHasOpenPositions'
    );
  });

  describe('close positions at a loss', async () => {
    before(async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(1900));
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(9));

      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-50),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: bn(1400),
      });
      await openPosition({
        ...commonOpenPositionProps,
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(-2000),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(7),
      });
    });

    it('accrued debt', async () => {
      assertBn.equal(await systems().PerpsMarket.getCollateralAmount(2, 0), bn(0)); // snxUSD empty
    });

    it('is not liquidatable', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2),
        'NotEligibleForMarginLiquidation'
      );
    });

    it('cannot withdraw', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, btcSynth.marketId(), -1),
        'InsufficientCollateralAvailableForWithdraw'
      );

      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, ethSynth.marketId(), -1),
        'InsufficientCollateralAvailableForWithdraw'
      );

      assertBn.equal(await systems().PerpsMarket.getWithdrawableMargin(2), 0);
    });
  });

  describe('move synth prices to make account liquidatable', async () => {
    let liquidateTxn: ethers.providers.TransactionResponse, seizedCollateralValue: ethers.BigNumber;
    before(async () => {
      await btcSynth.sellAggregator().mockSetCurrentPrice(bn(25_000));
      await ethSynth.sellAggregator().mockSetCurrentPrice(bn(1500));

      seizedCollateralValue = await systems().PerpsMarket.totalCollateralValue(2);

      // liquidate margin only
      liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidateMarginOnly(2);
    });

    const keeperReward = KeeperCosts.flagCost
      .mul(2)
      .add(KeeperCosts.liquidateCost)
      .add(MIN_LIQ_REWARD);

    it('sent keeper the right reward', async () => {
      const keeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
      assertBn.equal(keeperBalance, keeperReward);
    });

    it('emits event', async () => {
      await assertEvent(
        liquidateTxn,
        `AccountMarginLiquidation(2, ${seizedCollateralValue}, ${keeperReward})`,
        systems().PerpsMarket
      );
    });

    it('resets debt', async () => {
      assertBn.equal(await systems().PerpsMarket.debt(2), 0);
      assertBn.equal(await systems().PerpsMarket.reportedDebt(superMarketId()), 0);
    });
  });
});
