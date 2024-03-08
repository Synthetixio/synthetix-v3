import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';

describe('Liquidation - max liquidatable amount', () => {
  const { systems, provider, trader1, trader2, keeper, perpsMarkets } = bootstrapMarkets({
    liquidationGuards: {
      minLiquidationReward: bn(5),
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(1000),
      maxKeeperScalingRatioD18: bn(0),
    },
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
          maintenanceMarginScalar: bn(0.5),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: bn(0.05),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
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
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1500));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(1600));
  });

  before('open position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarket.marketId(),
      sizeDelta: bn(150),
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
      sizeDelta: bn(150),
      settlementStrategyId: perpsMarket.strategyId(),
      price: bn(10),
    });
  });

  before('lower price to liquidation', async () => {
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  /**
   * Based on the above configuration, the max liquidation amount for window == 100
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   */

  let initialLiquidationTime: number;

  describe('1st max liquidation amount', () => {
    before('call liquidate', async () => {
      const tx = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      initialLiquidationTime = await getTxTime(provider(), tx);
    });

    it('liquidated only 100 OP', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(50));
    });

    describe('calling liquidate again', () => {
      let initialKeeperBalance: ethers.BigNumber;
      before('call liquidate', async () => {
        initialKeeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
        await systems().PerpsMarket.connect(keeper()).liquidate(2);
      });

      it('liquidated nothing', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
        assertBn.equal(size, bn(50));
      });

      it('did not pay liquidation keeper reward', async () => {
        assertBn.equal(
          initialKeeperBalance,
          await systems().USD.balanceOf(await keeper().getAddress())
        );
      });
    });
  });

  describe('after 6 seconds', () => {
    before('fastforward', async () => {
      await fastForwardTo(initialLiquidationTime + 6, provider());
    });
    // liquidate call does nothing
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated nothing', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(50));
    });
  });

  // unlocked another 100 OP to liquidate
  describe('after 5 more seconds', () => {
    before('fastforward', async () => {
      await fastForwardTo(initialLiquidationTime + 11, provider());
    });
    // liquidate call liquidate the rest
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated the rest', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, 0);
    });
  });

  // liquidated 50 OP of first trader, 50 more left
  describe('liquidate second trader', () => {
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(3);
    });

    it('liquidated only 50 OP, 100 OP left', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      // 150 original size - 50
      assertBn.equal(size, bn(100));
    });
  });

  // wait 10 more seconds to liquidate the rest
  describe('after 10 more seconds', () => {
    before('fastforward', async () => {
      await fastForwardTo(initialLiquidationTime + 23, provider());
    });
    // liquidate call liquidate the rest
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(3);
    });

    it('liquidated the rest', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      assertBn.equal(size, 0);
    });
  });
});
