import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import { wei } from '@synthetixio/wei';

import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('Market Minimum Credit', () => {
  const traderAccountIds = [2, 3, 4];
  const _ETH_PRICE = bn(1000);
  const _BTC_PRICE = bn(30_000);
  const { systems, superMarketId, perpsMarkets, provider, trader1, trader2, keeper } =
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
          price: _ETH_PRICE,
          lockedOiRatioD18: bn(0.01),
        },
        {
          requestedMarketId: bn(26),
          name: 'Bitcoin',
          token: 'BTC',
          price: _BTC_PRICE,
          lockedOiRatioD18: bn(0.02),
        },
      ],
      traderAccountIds,
    });

  let ethMarket: PerpsMarket, btcMarket: PerpsMarket;
  before('identify actors', () => {
    ethMarket = perpsMarkets()[0];
    btcMarket = perpsMarkets()[1];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(10_000));
  });

  describe('with no positions', () => {
    it('should report total minimumCredit as snxUSD value owed to traders', async () => {
      const minimumCredit = await systems().PerpsMarket.minimumCredit(superMarketId());
      assertBn.equal(minimumCredit, bn(20_000));
    });
  });

  describe('open positions', () => {
    before(async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(150),
        settlementStrategyId: ethMarket.strategyId(),
        price: bn(1000),
      });
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: btcMarket.marketId(),
        sizeDelta: bn(-5),
        settlementStrategyId: btcMarket.strategyId(),
        price: bn(30000),
      });
    });

    it('reports correct debt', async () => {
      const minimumCredit = await systems().PerpsMarket.minimumCredit(superMarketId());

      const ethExpectedMinCredit = wei(150).mul(_ETH_PRICE).mul(wei(0.01)); // size * price * lockedOiRatio
      const btcExpectedMinCredit = wei(5).mul(_BTC_PRICE).mul(wei(0.02));

      const snxUSDDeposited = await systems().PerpsMarket.globalCollateralValue(0);

      assertBn.equal(
        minimumCredit,
        ethExpectedMinCredit.add(btcExpectedMinCredit).add(snxUSDDeposited).bn
      );
    });
  });
});
