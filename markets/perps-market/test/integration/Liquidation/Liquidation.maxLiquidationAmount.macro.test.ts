import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

describe('Liquidation - max liquidatable amount with multiple continuing liquidations', () => {
  const { systems, provider, trader1, trader2, keeper, perpsMarkets } = bootstrapMarkets({
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
          initialMarginFraction: bn(1),
          minimumInitialMarginRatio: bn(0),
          maintenanceMarginScalar: bn(0.66),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.01),
          // time window 30 seconds
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(30),
          minimumPositionMargin: bn(0),
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
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(900));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(3500));
  });

  before('open position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(100),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
    await openPosition({
      systems,
      provider,
      trader: trader2(),
      accountId: 3,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(300),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  /**
   * Based on the above configuration, the max liquidation amount for window == 300
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   */

  let initialLiquidationTime: number;

  describe('1st liquidation amount', () => {
    before('call liquidate', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    it('liquidated all 100 OP', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(0));
    });
  });

  describe('after 29 seconds', () => {
    let timeSetupCompletes: number;

    before('setup previous position', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(10));
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(90));
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        // make size delta smaller
        sizeDelta: bn(10),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(10),
      });
      const tx = await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
      timeSetupCompletes = await getTxTime(provider(), tx);
    });

    before('fastforward', async () => {
      await fastForwardTo(
        initialLiquidationTime + (29 - (timeSetupCompletes - initialLiquidationTime)),
        provider()
      );
    });
    // liquidate call liquidates trader again, now 20 has been liquidated within the window
    before('call liquidate', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    it('liquidated 10', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(0));
    });
  });

  describe('after another 29 seconds', () => {
    let timeSetupCompletes: number;

    before('setup previous position', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(10));
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(90));
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        // make size delta smaller
        sizeDelta: bn(10),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(10),
      });
      const tx = await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
      timeSetupCompletes = await getTxTime(provider(), tx);
    });

    before('fastforward', async () => {
      await fastForwardTo(
        initialLiquidationTime + (29 - (timeSetupCompletes - initialLiquidationTime)),
        provider()
      );
    });
    // liquidate call liquidates trader again, now 20 has been liquidated within the window, but 30 has in the last 58 seconds
    before('call liquidate', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    it('liquidated 10 again', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(0));
    });
  });

  describe('after another 29 seconds', () => {
    let timeSetupCompletes: number;

    before('setup previous position', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(10));
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(90));
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        // make size delta smaller
        sizeDelta: bn(10),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(10),
      });
      const tx = await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
      timeSetupCompletes = await getTxTime(provider(), tx);
    });

    before('fastforward', async () => {
      await fastForwardTo(
        initialLiquidationTime + (29 - (timeSetupCompletes - initialLiquidationTime)),
        provider()
      );
    });
    // liquidate call liquidates trader again, now 20 has been liquidated within the window, but 130 has in the last ~87 seconds
    before('call liquidate', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    it('liquidated 10 again', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(0));
    });
  });

  describe('liquidate second trader', () => {
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(3);
    });

    it('liquidated only 270, 20 left', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      assertBn.equal(size, bn(20));
    });
  });
});
