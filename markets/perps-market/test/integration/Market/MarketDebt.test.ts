import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { Signer, ethers } from 'ethers';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Market Debt - single market', () => {
  const orderFees = {
    makerFee: bn(0.0), // 0bps no fees
    takerFee: bn(0.0), // 0bps no fees
  };

  const { systems, superMarketId, perpsMarkets, provider, trader1, trader2, trader3, keeper } =
    bootstrapMarkets({
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
          },
        },
      ],
      traderAccountIds: [2, 3, 4],
    });

  let perpsMarket: PerpsMarket;

  before('identify actors', async () => {
    perpsMarket = perpsMarkets()[0];
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
    };
  }> = [
    {
      name: 'initial state',
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(0),
      },
    },
    {
      name: 'acc1 deposits 1000',
      user: {
        trader: trader1,
        accountId: 2,
        collateralDelta: bn(1000),
      },
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(1000), // 1000 deposited
      },
    },
    {
      name: 'acc1 opens 10x 10 long eth at 1000',
      user: {
        trader: trader1,
        accountId: 2,
        sizeDelta: bn(10),
      },
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(1000), // 1000 deposited
      },
    },
    {
      name: 'eth price change to 1200',
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(3000), // 1000 deposited + 2000 pnl
      },
    },
    {
      name: 'acc2 deposits 1200',
      user: {
        trader: trader2,
        accountId: 3,
        collateralDelta: bn(1200),
      },
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(4200), // 2200 deposited + 2000 pnl
      },
    },
    {
      name: 'acc2 opens 10x short 5 eth at 1200',
      user: {
        trader: trader2,
        accountId: 3,
        sizeDelta: bn(-5),
      },
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(4200), // 2200 deposited + 2000 pnl + 0 pnl
      },
    },
    {
      name: 'eht price change to 1100',
      market: {
        price: bn(1100),
      },
      expected: {
        marketDebt: bn(3700), // 2200 deposited + 1000 pnl + 500 pnl
      },
    },
    {
      name: 'acc3 deposits 3300',
      user: {
        trader: trader3,
        accountId: 4,
        collateralDelta: bn(3300),
      },
      market: {
        price: bn(1100),
      },
      expected: {
        marketDebt: bn(7000), // 5500 deposited + 1000 pnl + 500 pnl
      },
    },
    {
      name: 'acc3 opens 10x short 10 eth at 1100',
      user: {
        trader: trader3,
        accountId: 4,
        sizeDelta: bn(-10),
      },
      market: {
        price: bn(1100),
      },
      expected: {
        marketDebt: bn(7000), // 5500 deposited + 1000 pnl + 500 pnl + 0 pnl
      },
    },
    {
      name: 'eth price change to 1000',
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(7500), // 5500 deposited + 0 pnl + 1000 pnl + 1000 pnl
      },
    },
    {
      name: 'acc2 closes short',
      user: {
        trader: trader2,
        accountId: 3,
        sizeDelta: bn(5),
      },
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(7500), // 5500 deposited + 0 pnl + 1000 pnl_fixed + 1000 pnl
      },
    },
    {
      name: 'acc2 withdraw 1200 + 1000 (pnl)',
      user: {
        trader: trader2,
        accountId: 3,
        collateralDelta: bn(-2200),
      },
      market: {
        price: bn(1000),
      },
      expected: {
        marketDebt: bn(5300), // 4300 deposited + 0 pnl + 1000 pnl
      },
    },
    {
      name: 'eth price change to 1200',
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(5300), // 4300 deposited + 2000 pnl - 1000 pnl
      },
    },
    {
      name: 'acc3 closes short',
      user: {
        trader: trader3,
        accountId: 4,
        sizeDelta: bn(10),
      },
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(5300), // 4300 deposited + 2000 pnl - 1000 pnl_fixed
      },
    },
    {
      name: 'acc3 withdraw 3300 - 1000 (pnl)',
      user: {
        trader: trader3,
        accountId: 4,
        collateralDelta: bn(-2300),
      },
      market: {
        price: bn(1200),
      },
      expected: {
        marketDebt: bn(3000), // 1000 deposited + 2000 pnl
      },
    },
    {
      name: 'eth price change to 900',
      market: {
        price: bn(900),
      },
      expected: {
        marketDebt: bn(0), // 1000 deposited - 1000 pnl
      },
    },
    {
      name: 'acc1 closes long',
      user: {
        trader: trader1,
        accountId: 2,
        sizeDelta: bn(-10),
      },
      market: {
        price: bn(900),
      },
      expected: {
        marketDebt: bn(0), // 1000 deposited - 1000 pnl
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
            await openPosition({
              ...commonOpenPositionProps,
              trader: marketActivity.user!.trader(),
              accountId: marketActivity.user!.accountId,
              sizeDelta: marketActivity.user!.sizeDelta!,
              price: marketActivity.market!.price,
            });
          }
        });

        it('should have correct market debt', async () => {
          assertBn.equal(
            await systems().PerpsMarket.reportedDebt(superMarketId()),
            marketActivity.expected!.marketDebt
          );
        });
      });
    });
    after(restoreActivities);
  });
});
