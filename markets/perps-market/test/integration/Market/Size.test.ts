import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

// TODO: test maxMarketSize here as well
describe('Market - size test', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        name: 'Ether',
        token: 'snxETH',
        price: bn(2000),
        maxMarketValue: bn(9999999),
      },
    ],
    traderAccountIds: [2, 3],
  });

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
  [
    [bn(20), bn(40), bn(40)],
    [bn(-40), bn(40), bn(0)],
    [bn(-25), bn(65), bn(-25)],
    [bn(12), bn(53), bn(-13)],
    [bn(-5), bn(58), bn(-18)],
    [bn(-70), bn(128), bn(-88)],
    [bn(180), bn(92), bn(92)],
    [bn(-15), bn(77), bn(77)],
    [bn(-19), bn(58), bn(58)],
  ].forEach(([newOrderSize, expectedSize, expectedSkew]) => {
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
  });
});
