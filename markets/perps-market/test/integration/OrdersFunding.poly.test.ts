import { PerpsMarket, bn, bootstrapMarkets } from './bootstrap';
import { calculateFillPrice, openPosition } from './helpers';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

const _SECONDS_IN_DAY = 24 * 60 * 60;

const _SKEW_SCALE = bn(10_000);
const _TRADER_SIZE = bn(20);
const _ETH_PRICE = bn(2000);

// this test checks that the proper values are returned in the OrderSettled event after opening/closing positions
// specifically the accrued funding and pnl
describe('Orders events - funding', () => {
  const { systems, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 25,
        name: 'Ether',
        token: 'snxETH',
        price: _ETH_PRICE,
        fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: bn(3) },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let ethMarket: PerpsMarket;
  before('identify actors', async () => {
    ethMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    // trader accruing funding
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(50_000));
    // trader moving skew
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(1_000_000));
  });

  let openPositionTime: number;
  before('open 20 eth position', async () => {
    ({ settleTime: openPositionTime } = await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: ethMarket.marketId(),
      sizeDelta: _TRADER_SIZE,
      settlementStrategyId: ethMarket.strategyId(),
      price: _ETH_PRICE,
    }));
  });

  describe('new trader opens/closes positions', () => {
    before('move time and change price', async () => {
      await fastForwardTo(openPositionTime + _SECONDS_IN_DAY, provider());
      await ethMarket.aggregator().mockSetCurrentPrice(bn(2100));
    });

    before('open -10 eth position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(-10),
        settlementStrategyId: ethMarket.strategyId(),
        price: bn(2100),
      });
    });

    before('move time', async () => {
      await fastForwardTo(openPositionTime + _SECONDS_IN_DAY * 1.2, provider());
      await ethMarket.aggregator().mockSetCurrentPrice(bn(2050));
    });

    before('close position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(10),
        settlementStrategyId: ethMarket.strategyId(),
        price: _ETH_PRICE,
      });
    });

    before('move time', async () => {
      await fastForwardTo(openPositionTime + _SECONDS_IN_DAY * 1.5, provider());
      await ethMarket.aggregator().mockSetCurrentPrice(bn(2025));
    });

    let settleTx: ethers.providers.TransactionReceipt | ethers.providers.TransactionResponse;
    before('open position', async () => {
      ({ settleTx } = await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: ethMarket.marketId(),
        sizeDelta: bn(5),
        settlementStrategyId: ethMarket.strategyId(),
        price: bn(2025),
      }));
    });

    it('has emitted settled event', async () => {
      const params = [
        ethMarket.marketId(),
        3, // account id
        calculateFillPrice(wei(20), wei(_SKEW_SCALE), wei(5), wei(2025)).toString(18, true),
        0, // pnl
        0, // accrued funding
        bn(5).toString(), // size delta
        bn(5).toString(), // new size
        bn(5).toString(), // fees
        0,
        0,
        bn(5).toString(), // settlement reward
        `"${ethers.constants.HashZero}"`,
        `"${await keeper().getAddress()}"`,
      ];
      await assertEvent(settleTx, `OrderSettled(${params.join(', ')})`, systems().PerpsMarket);
    });
  });
});
