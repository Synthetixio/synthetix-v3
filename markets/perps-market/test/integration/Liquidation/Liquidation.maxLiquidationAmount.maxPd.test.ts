import { BigNumber, ethers } from 'ethers';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Liquidation - max premium discount', () => {
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

  const restore = snapshotCheckpoint(provider);

  let perpsMarket: PerpsMarket;
  before(async () => {
    await restore();

    perpsMarket = perpsMarkets()[0];

    // add collateral to margin
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(500));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(500));

    // open position
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

    // lower price to liquidation
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(1));
  });

  const getTrader1Position = () => systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
  const getTrader2Position = () => systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());

  /**
   * Based on the above configuration, the max liquidation amount for window == 25
   * * (maker + taker) * skewScale * secondsInWindow * multiplier
   */
  it('without max premium discount set', async () => {
    const [, , initialSize] = await getTrader1Position();
    assertBn.equal(initialSize, bn(90));

    // liquidate
    await (await systems().PerpsMarket.connect(keeper()).liquidate(2)).wait();

    // liquidated 25 OP
    const [, , sizeAfterLiquidation] = await getTrader1Position();
    assertBn.equal(sizeAfterLiquidation, bn(65));

    // call liquidate again
    await (await systems().PerpsMarket.connect(keeper()).liquidate(2)).wait();

    // liquidates no more OP
    const [, , sizeAfterSecondLiquidation] = await getTrader1Position();
    assertBn.equal(sizeAfterSecondLiquidation, bn(65));
  });

  /**
   * Scenario
   * Trader 1 position left to be liquidated = 65
   * maxPD set to 0.06 so under 60 OP skew is required for more liquidation otherwise trader has to wait for window to be liquidated
   * Trader 2 opens position which moves skew under 60 OP
   * Trader 1 can now be liquidated again by 25 OP
   */
  it('with max premium discount', async () => {
    const [, , initialSize] = await getTrader1Position();
    assertBn.equal(initialSize, bn(65));

    // set max premium discount
    await systems().PerpsMarket.connect(owner()).setMaxLiquidationParameters(
      perpsMarket.marketId(),
      bn(0.25),
      BigNumber.from(10),
      bn(0.06), // 60 OP maxPD
      ethers.constants.AddressZero
    );

    // trader 2 arbs
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

    await systems().PerpsMarket.connect(keeper()).liquidate(2);

    // liquidated 25 OP more
    const [, , sizeAfterArbLiquidation] = await getTrader1Position();
    assertBn.equal(sizeAfterArbLiquidation, bn(40));
  });

  it('should liquidate more of trader 1 since under max premium discount', async () => {
    // call liquidate twice more since under max premium discount
    await provider().send('evm_setAutomine', [false]);
    // Same block multiple liquidations are ignored and only one is effective
    const tx1 = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    const tx2 = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    const tx3 = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    const tx4 = await systems().PerpsMarket.connect(keeper()).liquidate(2);
    await provider().send('evm_setAutomine', [true]);
    await provider().send('evm_mine', []);
    await provider().send('evm_mine', []);
    await provider().send('evm_mine', []);
    await provider().send('evm_mine', []);

    // Make sure all the liquidation txns are finalised
    await Promise.all([tx1.wait(), tx2.wait(), tx3.wait(), tx4.wait()]);

    // liquidated 25 OP more in the same block (only one liquidation on the same block was actually effective)
    const [, , sizeOnSameBlock] = await getTrader1Position();
    assertBn.equal(sizeOnSameBlock, bn(15));

    // const [, , sizeOnNextBlock] = await getTrader1Position();
    // assertBn.equal(sizeOnNextBlock, bn(15));

    // liquidated 25 OP more in the next block
    await (await systems().PerpsMarket.connect(keeper()).liquidate(2)).wait();

    // await systems().PerpsMarket.connect(keeper()).liquidate(2);
    const [, , sizeOnNextBlock] = await getTrader1Position();
    assertBn.equal(sizeOnNextBlock, bn(0));
  });

  it('should liquidate trader 2', async () => {
    // change price of OP
    await perpsMarket.aggregator().mockSetCurrentPrice(bn(30));
    await systems().PerpsMarket.connect(keeper()).liquidate(3);
    // because the previous liquidation of trader 1 was of 15 OP, the remaining amount that can be liquidated is 10 OP
    const [, , size] = await getTrader2Position();
    assertBn.equal(size, 0);
  });
});
