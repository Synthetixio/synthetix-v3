import { PerpsMarket, bn, bootstrapMarkets, decimalMul } from '../bootstrap';
import { OpenPositionData, depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { Signer, ethers } from 'ethers';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Market Debt', () => {
  const orderFees = {
    makerFee: bn(0.0), // 0bps no fees
    takerFee: bn(0.0), // 0bps no fees
  };
  const ethPrice = bn(1000);

  const { systems, perpsMarkets, synthMarkets, provider, trader1, keeper } = bootstrapMarkets({
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
        name: 'Ether',
        token: 'snxETH',
        price: ethPrice,
        // setting to 0 to avoid funding and p/d price change affecting pnl
        fundingParams: { skewScale: bn(0), maxFundingVelocity: bn(0) },
        orderFees,
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];
  let perpsMarket: PerpsMarket;

  before('identify actors', async () => {
    perpsMarket = perpsMarkets()[0];
    ethMarketId = perpsMarket.marketId();
    btcSynth = synthMarkets()[0];
  });

  before('add liquidity that will be used to pay for trader gains', async () => {
    // TODO Need to add some liquidity in order to pay the gains to the trader
  });
  const marketActivities: Array<{
    name: string;
    user?: {
      trader: () => Signer;
      accountId: number;
      collateralDelta?: ethers.BigNumber;
      sizeDelta?: ethers.BigNumber;
    };
    market?: { id: ethers.BigNumber; price?: ethers.BigNumber };
    expected?: {
      marketDebt: ethers.BigNumber;
      ethMarketDebt: ethers.BigNumber;
      btcMarketDebt: ethers.BigNumber;
    };
  }> = [
    {
      name: 'acc1 deposits 1000',
      user: {
        trader: trader1,
        accountId: 2,
        collateralDelta: bn(1000),
      },
      market: {
        id: bn(1),
        price: bn(1000),
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
        sizeDelta: bn(0),
      },
      market: {
        id: bn(1),
      },
      expected: {
        marketDebt: bn(0),
        ethMarketDebt: bn(0),
        btcMarketDebt: bn(0),
      },
    },
    { name: 'eth price change to 1200' },
    { name: 'acc2 deposits 1000' },
    { name: 'acc2 opens 20x short 10 eth at 1200' },
    { name: 'eht price change to 1100' },
    { name: 'acc3 deposits 1000' },
    { name: 'acc3 opens 20x short 20 eth at 1100' },
    { name: 'eth price change to 1000' },
    { name: 'acc2 closes short' },
    { name: 'eth price change to 1500' },
    { name: 'acc3 closes short' },
    { name: 'eth price change to 900' },
  ];

  describe(`Using snxUSD as collateral`, () => {
    let commonOpenPositionProps: Pick<
      OpenPositionData,
      'systems' | 'provider' | 'keeper' | 'settlementStrategyId'
    >;
    const restoreActivities = snapshotCheckpoint(provider);

    before('identify common props', async () => {
      commonOpenPositionProps = {
        systems,
        provider,
        settlementStrategyId: perpsMarket.strategyId(),
        keeper: keeper(),
      };
    });

    marketActivities.forEach((marketActivity) => {
      describe(`Market Activity Step: ${marketActivity.name}`, () => {
        before('collect initial stats', async () => {
          // Collect initial stats if needed
        });

        before('set step price', async () => {
          // TODO Need to change the price to the desired value for the market if needed
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
              trader: trader1,
              accountId: () => marketActivity.user!.accountId,
              collaterals: [{ snxUSDAmount: () => marketActivity.user!.collateralDelta! }],
            });
          }
        });

        before('update position', async () => {
          if (
            marketActivity.user &&
            marketActivity.market &&
            marketActivity.user.sizeDelta &&
            !marketActivity.user.sizeDelta.isZero()
          ) {
            // Update position size for the desired market and account
            await openPosition({
              ...commonOpenPositionProps,
              trader: marketActivity.user!.trader(),
              accountId: marketActivity.user!.accountId,
              marketId: marketActivity.market!.id,
              sizeDelta: marketActivity.user!.sizeDelta!,
              price: ethPrice,
            });
          }
        });

        before('collect final stats', async () => {
          // Collect final stats if needed
        });

        it('should have correct market debt', async () => {
          // TODO: calculate the right values and assert them, or use the ones on the step
          const expected = marketActivity.expected;
        });
      });
    });
    after(restoreActivities);
  });
});
