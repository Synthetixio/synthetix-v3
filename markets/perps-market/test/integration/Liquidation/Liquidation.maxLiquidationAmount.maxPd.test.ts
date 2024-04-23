import { BigNumber, ethers } from 'ethers';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { withExplicitEvmMine } from '../../../../bfp-market/test/helpers';

describe('Liquidation - max pd', () => {
  const { systems, provider, owner, trader1, trader2, keeper, perpsMarkets } = bootstrapMarkets({
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
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(500));
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
  describe('without max pd set', () => {
    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated 25 OP', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(65));
    });

    describe('call liquidate again', () => {
      before('call liquidate', async () => {
        await systems().PerpsMarket.connect(keeper()).liquidate(2);
      });
      it('liquidates no more OP', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
        assertBn.equal(size, bn(65));
      });
    });
  });

  /**
   * Scenario
   * Trader 1 position left to be liquidated = 75
   * maxPD set to 0.06 so under 60 OP skew is required for more liquidation otherwise trader has to wait for window to be liquidated
   * Trader 2 opens position which moves skew under 60 OP
   * Trader 1 can now be liquidated again by 25 OP
   */
  describe('with max pd', () => {
    before('set max pd', async () => {
      await systems().PerpsMarket.connect(owner()).setMaxLiquidationParameters(
        perpsMarket.marketId(),
        bn(0.25),
        BigNumber.from(10),
        bn(0.06), // 60 OP maxPD
        ethers.constants.AddressZero
      );
    });

    before('trader 2 arbs', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(-25),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1),
      });
    });

    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    it('liquidated 25 OP more', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(size, bn(40));
    });
  });

  describe('more liquidation of trader 1 since under max pd', () => {
    describe('same block', () => {
      before('call liquidate twice more since under max pd', async () => {
        const f = () =>
          systems().TrustedMulticallForwarder.aggregate([
            {
              target: systems().PerpsMarket.address,
              callData: systems().PerpsMarket.interface.encodeFunctionData('liquidate', [2]),
            },
            {
              target: systems().PerpsMarket.address,
              callData: systems().PerpsMarket.interface.encodeFunctionData('liquidate', [2]),
            },
          ]);

        await withExplicitEvmMine(f, provider());
      });

      it('liquidated 25 OP more', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
        assertBn.equal(size, bn(15));
      });
    });

    describe('next block', () => {
      before('call liquidate again', async () => {
        await systems().PerpsMarket.connect(keeper()).liquidate(2);
      });

      it('liquidated 25 OP more', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
        assertBn.equal(size, bn(0));
      });
    });
  });

  describe('liquidate trader 2', () => {
    before('change price of OP', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(30));
    });

    before('call liquidate', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(3);
    });

    // because the previous liquidation of trader 1 was of 15 OP, the remaining amount that can be liquidated is 10 OP
    it('liquidated all 10 OP', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      assertBn.equal(size, 0);
    });
  });
});
