import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';

describe('Liquidation - partial - multi collateral', async () => {
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
  ];

  const { systems, provider, trader1, synthMarkets, perpsMarkets, owner } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(30_000),
        sellPrice: bn(30_000),
      },
      {
        name: 'Ethereum',
        token: 'snxETH',
        buyPrice: bn(2000),
        sellPrice: bn(2000),
      },
    ],
    perpsMarkets: perpsMarketConfigs,
    traderAccountIds: [2, 3],
  });

  let btcSynth: SynthMarkets[number], ethSynth: SynthMarkets[number];

  before('identify actors', async () => {
    btcSynth = synthMarkets()[0];
    ethSynth = synthMarkets()[1];
  });

  before('add collateral to margin', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          synthMarket: () => btcSynth,
          snxUSDAmount: () => bn(10_000),
        },
        {
          synthMarket: () => ethSynth,
          snxUSDAmount: () => bn(4000),
        },
      ],
    });
  });

  // sanity check
  it('has correct total collaterl value', async () => {
    assertBn.near(
      await systems().PerpsMarket.totalCollateralValue(2),
      bn(10_000 + 4000),
      bn(0.00001)
    );
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
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), bn(80_000));
    });

    [
      { size: bn(-1), pnl: bn(-150) }, // btc
      { size: bn(20), pnl: bn(-400) }, // eth
      { size: bn(2000), pnl: bn(-100) }, // link
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
  });

  describe('make account liquidatable', () => {
    before(`change eth price`, async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(31000)); // btc
      await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(1625)); // eth
      await perpsMarkets()[2].aggregator().mockSetCurrentPrice(bn(3)); // link
    });

    before('liquidate account', async () => {
      await systems().PerpsMarket.liquidate(2);
    });

    it('empties account margin', async () => {
      assertBn.equal(await systems().PerpsMarket.totalCollateralValue(2), 0);
    });

    it('empties open interest', async () => {
      assertBn.equal(await systems().PerpsMarket.totalAccountOpenInterest(2), 0);
    });
  });
});
