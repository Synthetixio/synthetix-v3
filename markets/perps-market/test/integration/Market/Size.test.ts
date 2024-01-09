import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { depositCollateral, openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Market - size test', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: bn(2000),
        maxMarketSize: bn(10_000),
        maxMarketValue: bn(40_000_000),
      },
    ],
    traderAccountIds: [2, 3],
  });

  const restore = snapshotCheckpoint(provider);

  let ethMarket: PerpsMarket;
  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(1_000_000));
  });

  before('open 20 eth position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: bn(20),
      settlementStrategyId: ethMarket.strategyId(),
      price: bn(2000),
    });
  });

  // starting skew = 20 from above order
  // below test:
  // [newOrderSize, expectedSize, expectedSkew]
  for (const [newOrderSize, expectedSize, expectedSkew] of [
    [bn(20), bn(40), bn(40)],
    [bn(-40), bn(40), bn(0)],
    [bn(-25), bn(65), bn(-25)],
    [bn(12), bn(53), bn(-13)],
    [bn(-5), bn(58), bn(-18)],
    [bn(-70), bn(128), bn(-88)],
    [bn(180), bn(92), bn(92)],
    [bn(-15), bn(77), bn(77)],
    [bn(-19), bn(58), bn(58)],
  ]) {
    describe('skew and size test', () => {
      before('open position', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader2(),
          accountId: 3,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: newOrderSize,
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
      });

      it(`should have market size ${expectedSize} and skew ${expectedSkew} after newOrderSize ${newOrderSize}`, async () => {
        const market = await systems().PerpsMarket.getMarketSummary(ethMarket.marketId());
        assertBn.equal(market.size, expectedSize);
        assertBn.equal(market.skew, expectedSkew);
      });
    });
  }

  describe('max market value', () => {
    describe('success', () => {
      beforeEach(restore);
      beforeEach('add collateral to margin', async () => {
        await depositCollateral({
          accountId: () => 2,
          collaterals: [
            {
              snxUSDAmount() {
                return bn(1_000_000);
              },
            },
          ],
          systems,
          trader: () => trader1(),
        });
        await depositCollateral({
          accountId: () => 3,
          collaterals: [
            {
              snxUSDAmount() {
                return bn(1_000_000);
              },
            },
          ],
          systems,
          trader: () => trader2(),
        });
      });
      beforeEach('open position that uses all of available market size', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(10_000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
      });
      it('if user reduces size of his own trade', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(-1000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
        assertBn.equal(
          (await systems().PerpsMarket.getMarketSummary(ethMarket.marketId())).size,
          bn(9_000)
        );
      });

      it('if max market size: 10_000, current size: 10_000, opening short: -9_000, results in 19_000 oi', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader2(),
          accountId: 3,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(-9_000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
        assertBn.equal(
          (await systems().PerpsMarket.getMarketSummary(ethMarket.marketId())).size,
          bn(19_000)
        );
      });

      it('if max market size: 10_000, current size: 10_000, opening short: 10_000, results in 20_000 oi ', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader2(),
          accountId: 3,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(-10_000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
        assertBn.equal(
          (await systems().PerpsMarket.getMarketSummary(ethMarket.marketId())).size,
          bn(20_000)
        );
      });
    });

    describe('reverts', () => {
      before(restore);
      before('add collateral to margin', async () => {
        await depositCollateral({
          accountId: () => 2,
          collaterals: [
            {
              snxUSDAmount() {
                return bn(1_000_000);
              },
            },
          ],
          systems,
          trader: () => trader1(),
        });
        await depositCollateral({
          accountId: () => 3,
          collaterals: [
            {
              snxUSDAmount() {
                return bn(1_000_000);
              },
            },
          ],
          systems,
          trader: () => trader2(),
        });
      });
      before('open position that uses all of available market size', async () => {
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(10_000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });
      });

      it('if max market size is reached', async () => {
        await assertRevert(
          openPosition({
            systems,
            provider,
            trader: trader1(),
            accountId: 2,
            keeper: keeper(),
            marketId: ethMarket.marketId(),
            sizeDelta: bn(1),
            settlementStrategyId: ethMarket.strategyId(),
            price: bn(2000),
          }),
          `MaxOpenInterestReached(${ethMarket.marketId()}, ${bn(10_000).toString()}, ${bn(
            10_001
          ).toString()})`
        );
      });

      it('if exceeds max market size with short', async () => {
        await assertRevert(
          openPosition({
            systems,
            provider,
            trader: trader2(),
            accountId: 3,
            keeper: keeper(),
            marketId: ethMarket.marketId(),
            sizeDelta: bn(-20_000),
            settlementStrategyId: ethMarket.strategyId(),
            price: bn(2000),
          }),
          `MaxOpenInterestReached(${ethMarket.marketId()}, ${bn(10_000).toString()}, ${bn(
            20_000
          ).toString()})`
        );
      });

      it('if max market value is reached', async () => {
        // reduce position size to 5000
        await openPosition({
          systems,
          provider,
          trader: trader1(),
          accountId: 2,
          keeper: keeper(),
          marketId: ethMarket.marketId(),
          sizeDelta: bn(-5_000),
          settlementStrategyId: ethMarket.strategyId(),
          price: bn(2000),
        });

        // 40_000_000 is max market value
        // 5000 * 8000 = 40_000_000
        await ethMarket.aggregator().mockSetCurrentPrice(bn(8000));
        await assertRevert(
          openPosition({
            systems,
            provider,
            trader: trader1(),
            accountId: 2,
            keeper: keeper(),
            marketId: ethMarket.marketId(),
            sizeDelta: bn(1),
            settlementStrategyId: ethMarket.strategyId(),
            price: bn(8000),
          }),
          `MaxUSDOpenInterestReached(${ethMarket.marketId()}, ${bn(40_000_000).toString()}, ${bn(
            5_001
          ).toString()}, ${bn(8000).toString()})`
        );
      });

      it('if exceeds max market value with short', async () => {
        await assertRevert(
          openPosition({
            systems,
            provider,
            trader: trader2(),
            accountId: 3,
            keeper: keeper(),
            marketId: ethMarket.marketId(),
            sizeDelta: bn(-10_000),
            settlementStrategyId: ethMarket.strategyId(),
            price: bn(8000),
          }),
          `MaxUSDOpenInterestReached(${ethMarket.marketId()}, ${bn(40_000_000).toString()}, ${bn(
            10_000
          ).toString()}, ${bn(8000).toString()})`
        );
      });
    });
  });
});
