import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, openPosition } from '../helpers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Liquidation - margin', async () => {
  const perpsMarketConfigs = [
    {
      requestedMarketId: 50,
      name: 'Bitcoin',
      token: 'BTC',
      price: bn(30_000),
      fundingParams: { skewScale: bn(100), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        maintenanceMarginFraction: bn(1),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 51,
      name: 'Ether',
      token: 'ETH',
      price: bn(2000),
      fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        maintenanceMarginFraction: bn(1),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 52,
      name: 'Link',
      token: 'LINK',
      price: bn(5),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(2),
        maintenanceMarginFraction: bn(1),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 53,
      name: 'Arbitrum',
      token: 'ARB',
      price: bn(2),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(1.5),
        maintenanceMarginFraction: bn(0.75),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
    {
      requestedMarketId: 54,
      name: 'Optimism',
      token: 'OP',
      price: bn(2),
      fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
      liquidationParams: {
        initialMarginFraction: bn(1.5),
        maintenanceMarginFraction: bn(0.75),
        maxLiquidationLimitAccumulationMultiplier: bn(1),
        liquidationRewardRatio: bn(0.05),
        maxSecondsInLiquidationWindow: bn(10),
        minimumPositionMargin: bn(0),
      },
      settlementStrategy: {
        settlementReward: bn(0),
      },
    },
  ];

  const { systems, provider, trader1, perpsMarkets, owner, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2, 3],
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(20_000));
  });

  let commonOpenPositionProps: Pick<
    OpenPositionData,
    'systems' | 'provider' | 'trader' | 'accountId' | 'keeper'
  >;
  before('identify common props', async () => {
    commonOpenPositionProps = {
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: trader1(),
    };
  });

  before('open positions', async () => {
    const positionSizes = [
      bn(-1), // btc short
      bn(20), // eth long
      bn(2000), // link long
      bn(5000), // arb long
      bn(5000), // op long
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

  describe('account check after initial positions open', async () => {
    it('should have correct open interest', async () => {
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), bn(100_000));
    });

    [
      { size: bn(-1), pnl: bn(-150) }, // btc
      { size: bn(20), pnl: bn(-400) }, // eth
      { size: bn(2000), pnl: bn(-100) }, // link
      { size: bn(5000), pnl: bn(-250) }, // arb
      { size: bn(5000), pnl: bn(-250) }, // op
    ].forEach(({ size, pnl }, i) => {
      it(`should have correct position for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl, , positionSize] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        assertBn.equal(positionPnl, pnl);
        assertBn.equal(positionSize, size);
      });
    });

    // pnl (due to skew)
    [
      bn(-150), // btc
      bn(-400), // eth
      bn(-100), // link
      bn(-250), // arb
      bn(-250), // op
    ].forEach((pnl, i) => {
      it(`should have correct position pnl for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        assertBn.equal(positionPnl, pnl);
      });
    });

    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(18_850));
    });

    it('is not eligible for liquidation', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidate(2),
        'NotEligibleForLiquidation'
      );
    });
  });

  describe('prices changes', () => {
    [
      bn(28000), // btc
      bn(1900), // eth
      bn(4.6), // link
      bn(1.9), // arb
      bn(1.8), // op
    ].forEach((price, i) => {
      before(`change ${perpsMarketConfigs[i].token} price`, async () => {
        await perpsMarkets()[i].aggregator().mockSetCurrentPrice(price);
      });
    });

    [
      bn(1850), // btc
      bn(-2400), // eth
      bn(-900), // link
      bn(-750), // arb
      bn(-1250), // op
    ].forEach((pnl, i) => {
      it(`should have correct position pnl for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        assertBn.equal(positionPnl, pnl);
      });
    });

    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(16_550));
    });

    it('is not eligible for liquidation', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(keeper()).liquidate(2),
        'NotEligibleForLiquidation'
      );
    });
  });
  describe('price change - available margin 0 ', () => {
    [
      bn(31000), // btc
      bn(1775), // eth
      bn(3), // link
      bn(1), // arb
      bn(1.13), // op
    ].forEach((price, i) => {
      before(`change ${perpsMarketConfigs[i].token} price`, async () => {
        await perpsMarkets()[i].aggregator().mockSetCurrentPrice(price);
      });
    });

    [
      bn(-1150), // btc
      bn(-4900), // eth
      bn(-4100), // link
      bn(-5250), // arb
      bn(-4600), // op
    ].forEach((pnl, i) => {
      it(`should have correct position pnl for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        assertBn.equal(positionPnl, pnl);
      });
    });
    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(0));
    });
  });

  describe('minimumPositionMargin increased -> eligible for liquidation', () => {
    const restoreMinimumPositionMargin = snapshotCheckpoint(provider);
    before('set minimumPositionMargin for OP to 50', async () => {
      const opMarketId = perpsMarkets()[4].marketId();
      const initialMarginFraction = bn(1.5);
      const maintenanceMarginFraction = bn(0.75);
      const maxLiquidationLimitAccumulationMultiplier = bn(1);
      const liquidationRewardRatio = bn(0.05);
      const maxSecondsInLiquidationWindow = bn(10);
      const minimumPositionMargin = bn(50); // this is the only change from the initial values
      await systems()
        .PerpsMarket.connect(owner())
        .setLiquidationParameters(
          opMarketId,
          initialMarginFraction,
          maintenanceMarginFraction,
          maxLiquidationLimitAccumulationMultiplier,
          liquidationRewardRatio,
          maxSecondsInLiquidationWindow,
          minimumPositionMargin
        );
    });
    // Changing minimumPositionMargin does not have an affect on available margin
    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(0));
    });

    // It does have an affect on liquidations, so withdrawals should be blocked
    it('reverts when trying to withdraw', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-100)),
        'AccountLiquidatable(2)'
      );
    });
    // reset minimumPositionMargin to 0
    after(restoreMinimumPositionMargin);
  });

  describe('price change - eligible for liquidation', () => {
    [
      bn(31000), // btc
      bn(1775), // eth
      bn(3), // link
      bn(1), // arb
      bn(1), // op, the only one that has a price change
    ].forEach((price, i) => {
      before(`change ${perpsMarketConfigs[i].token} price`, async () => {
        await perpsMarkets()[i].aggregator().mockSetCurrentPrice(price);
      });
    });

    [
      bn(-1150), // btc
      bn(-4900), // eth
      bn(-4100), // link
      bn(-5250), // arb
      bn(-5250), // op
    ].forEach((pnl, i) => {
      it(`should have correct position pnl for ${perpsMarketConfigs[i].token}`, async () => {
        const [positionPnl] = await systems().PerpsMarket.getOpenPosition(
          2,
          perpsMarkets()[i].marketId()
        );
        assertBn.equal(positionPnl, pnl);
      });
    });

    it('has correct available margin', async () => {
      assertBn.equal(await systems().PerpsMarket.getAvailableMargin(2), bn(-650));
    });

    it('reverts when trying to withdraw', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(-100)),
        'AccountLiquidatable'
      );
    });

    it('does not allow you to open a position', async () => {
      await assertRevert(
        openPosition({
          ...commonOpenPositionProps,
          marketId: perpsMarkets()[0].marketId(),
          sizeDelta: bn(-1),
          settlementStrategyId: perpsMarkets()[0].strategyId(),
          price: perpsMarketConfigs[0].price,
        }),
        'AccountLiquidatable'
      );
    });
  });
});
