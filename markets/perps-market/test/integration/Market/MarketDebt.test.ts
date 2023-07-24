import { PerpsMarket, bn, bootstrapMarkets, toNum } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { Signer, ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Market Debt - single market', () => {
  const orderFees = {
    makerFee: bn(0.0), // 0bps no fees
    takerFee: bn(0.0), // 0bps no fees
  };

  const { systems, perpsMarkets, provider, trader1, trader2, trader3, keeper } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
    ],
    perpsMarkets: [
      {
        requestedMarketId: bn(25),
        name: 'Ether',
        token: 'snxETH',
        price: bn(1000),
        // setting to 0 to avoid funding and p/d price change affecting pnl
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
        orderFees,
        settlementStrategy: {
          settlementReward: bn(0),
          priceDeviationTolerance: bn(50),
        },
      },
    ],
    traderAccountIds: [2, 3, 4],
  });

  // let ethMarketId: ethers.BigNumber;
  // let btcSynth: SynthMarkets[number];
  let perpsMarket: PerpsMarket;

  before('identify actors', async () => {
    perpsMarket = perpsMarkets()[0];
    // ethMarketId = perpsMarket.marketId();
    // btcSynth = synthMarkets()[0];
  });

  before('add liquidity that will be used to pay for trader gains', async () => {
    // TODO Need to add some liquidity in order to pay the gains to the trader
  });

  const marketActivities: Array<{
    name: string;
    user?: {
      trader: () => Signer;
      accountId: number;
      collateralDelta?: ethers.BigNumber; // amount of collateral to deposit or withdraw in the step
      sizeDelta?: ethers.BigNumber; // position size change to open or close in the step
    };
    market?: { price: ethers.BigNumber }; // market to change the price and new price
    expected?: {
      // expected results to check on the step
      marketDebt: ethers.BigNumber;
      ethMarketDebt: ethers.BigNumber;
      btcMarketDebt: ethers.BigNumber;
    };
  }> = [
    {
      name: 'initial state',
      market: {
        price: bn(1000),
      },
    },
    {
      name: 'acc1 deposits 1000',
      user: {
        trader: trader1,
        accountId: 2,
        collateralDelta: bn(1000),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc1 opens 10x 10 long eth at 1000',
      user: {
        trader: trader1,
        accountId: 2,
        sizeDelta: bn(10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'eth price change to 1200',
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc2 deposits 500',
      user: {
        trader: trader2,
        accountId: 3,
        collateralDelta: bn(500),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc2 opens 20x short 20 eth at 1200',
      user: {
        trader: trader2,
        accountId: 3,
        sizeDelta: bn(-10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'eht price change to 1100',
      market: {
        price: bn(1100),
      },
    },
    {
      name: 'acc3 deposits 3000',
      user: {
        trader: trader3,
        accountId: 4,
        collateralDelta: bn(3000),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc3 opens 10x short 10 eth at 1100',
      user: {
        trader: trader3,
        accountId: 4,
        sizeDelta: bn(-10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'eth price change to 1000',
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc2 closes short',
      user: {
        trader: trader2,
        accountId: 3,
        sizeDelta: bn(10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'eth price change to 1200',
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc3 closes short',
      user: {
        trader: trader3,
        accountId: 4,
        sizeDelta: bn(10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'eth price change to 900',
      market: {
        price: bn(900),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    {
      name: 'acc1 closes long',
      user: {
        trader: trader1,
        accountId: 2,
        sizeDelta: bn(-10),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
  ];

  describe(`Using snxUSD as collateral`, () => {
    let commonOpenPositionProps: Pick<
      OpenPositionData,
      'systems' | 'provider' | 'keeper' | 'settlementStrategyId' | 'marketId'
    >;
    const restoreActivities = snapshotCheckpoint(provider);

    before('identify common props', async () => {
      commonOpenPositionProps = {
        systems,
        provider,
        settlementStrategyId: perpsMarket.strategyId(),
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
      };
    });

    marketActivities.forEach((marketActivity) => {
      describe(`Market Activity Step: ${marketActivity.name}`, () => {
        before('collect initial stats', async () => {
          // Collect initial stats if needed
        });

        before('set price', async () => {
          if (
            marketActivity.market &&
            marketActivity.market.price &&
            !marketActivity.market.price.isZero()
          ) {
            await perpsMarket.aggregator().mockSetCurrentPrice(marketActivity.market.price);
          }
        });

        before('update collateral', async () => {
          if (
            marketActivity.user &&
            marketActivity.user.collateralDelta &&
            !marketActivity.user.collateralDelta.isZero()
          ) {
            await depositCollateral({
              systems,
              trader: marketActivity.user!.trader,
              accountId: () => marketActivity.user!.accountId,
              collaterals: [{ snxUSDAmount: () => marketActivity.user!.collateralDelta! }],
            });
          }
        });

        before('update position', async () => {
          if (
            marketActivity.user &&
            marketActivity.user.sizeDelta &&
            !marketActivity.user.sizeDelta.isZero()
          ) {
            // Update position size for the desired market and account
            await openPosition({
              ...commonOpenPositionProps,
              trader: marketActivity.user!.trader(),
              accountId: marketActivity.user!.accountId,
              sizeDelta: marketActivity.user!.sizeDelta!,
              price: bn(1000),
            });
          }
        });

        before('collect final stats', async () => {
          // Collect final stats if needed
        });

        it('should have correct market debt', async () => {
          const t1OI = await systems().PerpsMarket.totalAccountOpenInterest(2);
          const t2OI = await systems().PerpsMarket.totalAccountOpenInterest(3);
          const t3OI = await systems().PerpsMarket.totalAccountOpenInterest(4);

          const [t1positionPnl, , t1positionSize] = await systems().PerpsMarket.getOpenPosition(
            2,
            perpsMarket.marketId()
          );
          const [t2positionPnl, , t2positionSize] = await systems().PerpsMarket.getOpenPosition(
            3,
            perpsMarket.marketId()
          );
          const [t3positionPnl, , t3positionSize] = await systems().PerpsMarket.getOpenPosition(
            4,
            perpsMarket.marketId()
          );

          const t1AvailableMargin = await systems().PerpsMarket.getAvailableMargin(2);
          const t2AvailableMargin = await systems().PerpsMarket.getAvailableMargin(3);
          const t3AvailableMargin = await systems().PerpsMarket.getAvailableMargin(4);

          console.log('==== MARKET DEBT ====');
          console.log(' ==> t1OI', toNum(t1OI));
          console.log(' ==> t2OI', toNum(t2OI));
          console.log(' ==> t3OI', toNum(t3OI));
          console.log(' ==> t1positionPnl', toNum(t1positionPnl));
          console.log(' ==> t2positionPnl', toNum(t2positionPnl));
          console.log(' ==> t3positionPnl', toNum(t3positionPnl));
          console.log(' ==> t1positionSize', toNum(t1positionSize));
          console.log(' ==> t2positionSize', toNum(t2positionSize));
          console.log(' ==> t3positionSize', toNum(t3positionSize));
          console.log(' ==> t1AvailableMargin', toNum(t1AvailableMargin));
          console.log(' ==> t2AvailableMargin', toNum(t2AvailableMargin));
          console.log(' ==> t3AvailableMargin', toNum(t3AvailableMargin));
          console.log('==== END MARKET DEBT ====');

          // TODO: calculate the right values and assert them, or use the ones on the step
          // const expected = marketActivity.expected;
        });
      });
    });
    after(restoreActivities);
  });
});
