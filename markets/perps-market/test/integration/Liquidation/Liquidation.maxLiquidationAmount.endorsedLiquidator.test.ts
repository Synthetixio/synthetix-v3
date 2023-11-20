import { BigNumber } from 'ethers';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('Liquidation - endorsed liquidator', () => {
  const { systems, provider, owner, trader1, keeper, perpsMarkets } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'Optimism',
        token: 'OP',
        price: bn(10),
        orderFees: {
          makerFee: bn(0.007),
          takerFee: bn(0.003),
        },
        fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: bn(3),
          minimumInitialMarginRatio: bn(0),
          maintenanceMarginScalar: bn(0.66),
          maxLiquidationLimitAccumulationMultiplier: bn(0.25),
          liquidationRewardRatio: bn(0.05),
          // time window 10 seconds
          maxSecondsInLiquidationWindow: BigNumber.from(10),
          minimumPositionMargin: bn(0),
          maxLiquidationPd: bn(0.06),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
    ],
    traderAccountIds: [2, 3],
  });

  let perpsMarket: PerpsMarket;
  before('identify actors', () => {
    perpsMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(500));
  });

  before('open position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(90),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  /**
   * Based on the above configuration, the max liquidation amount for window == 25
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   */
  describe('with endorsed liquidator', () => {
    before('set max pd', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxLiquidationParameters(
          perpsMarket.marketId(),
          bn(0.25),
          BigNumber.from(10),
          bn(0.06), // 60 OP maxPD
          await keeper().getAddress()
        );
    });

    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated entire position', async () => {
      const [, , size] = await systems()
        .PerpsMarket.connect(keeper())
        .getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(0));
    });

    it('did not send any liquidation reward', async () => {
      assertBn.equal(await systems().USD.balanceOf(await keeper().getAddress()), 0);
    });
  });
});
