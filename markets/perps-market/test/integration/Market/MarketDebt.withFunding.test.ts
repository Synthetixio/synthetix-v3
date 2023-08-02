import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { PerpsMarket, bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

const _SKEW_SCALE = bn(25_000);
const _MAX_FUNDING_VELOCITY = bn(3);
const _SECONDS_IN_DAY = 24 * 60 * 60;

describe('Market Debt - with funding', () => {
  const traderAccountIds = [2, 3, 4];
  const { systems, superMarketId, perpsMarkets, provider, trader1, trader2, trader3, keeper } =
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
          price: bn(1000),
          // setting to 0 to avoid funding and p/d price change affecting pnl
          orderFees: {
            makerFee: bn(0.0005), // 0bps no fees
            takerFee: bn(0.00025),
          },
          fundingParams: { skewScale: _SKEW_SCALE, maxFundingVelocity: _MAX_FUNDING_VELOCITY },
          liquidationParams: {
            initialMarginFraction: bn(3),
            maintenanceMarginFraction: bn(2),
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
      traderAccountIds,
    });

  let perpsMarket: PerpsMarket;
  before('identify actors', () => {
    perpsMarket = perpsMarkets()[0];
  });

  before('add collateral to margin', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, bn(10_000));
    await systems().PerpsMarket.connect(trader3()).modifyCollateral(4, 0, bn(100_000));
  });

  describe('with no positions', () => {
    it('should report total collateral value as debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.equal(debt, bn(120_000));
    });
  });

  let openPositionTime: number;
  describe('open positions', () => {
    before(async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(150),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1000),
      });
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(-50),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1000),
      });
      openPositionTime = await openPosition({
        systems,
        provider,
        trader: trader3(),
        accountId: 4,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(200),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1000),
      });
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.near(debt, totalCollateralValue.add(unrealizedTraderPnl), bn(0.0001));
    });
  });

  describe('a day goes by', () => {
    before('fast forward', async () => {
      await fastForwardTo(openPositionTime + _SECONDS_IN_DAY, provider());
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.near(debt, totalCollateralValue.add(unrealizedTraderPnl), bn(0.0001));
    });
  });

  describe('price change', () => {
    before('change price', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(1050));
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.near(debt, totalCollateralValue.add(unrealizedTraderPnl), bn(0.0001));
    });
  });

  describe('reduce trader 3 position', () => {
    before(async () => {
      await openPosition({
        systems,
        provider,
        trader: trader3(),
        accountId: 4,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(-50),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1050),
      });
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.equal(debt, totalCollateralValue.add(unrealizedTraderPnl));
    });
  });

  describe('short more eth trader 2 position', () => {
    before('trader 2 adds more size', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader2(),
        accountId: 3,
        keeper: keeper(),
        marketId: perpsMarket.marketId(),
        sizeDelta: bn(-50),
        settlementStrategyId: perpsMarket.strategyId(),
        price: bn(1050),
      });
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.equal(debt, totalCollateralValue.add(unrealizedTraderPnl));
    });
  });

  describe('trader 2 gets liquidated', () => {
    before('change price', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(1135));
      await systems().PerpsMarket.connect(keeper()).liquidate(3);
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.equal(debt, totalCollateralValue.add(unrealizedTraderPnl));
    });
  });

  let partialLiquidationTime: number;
  describe('trader 1 gets partially liquidated', () => {
    before('change price', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(950));
      const liquidateTxn = await systems().PerpsMarket.connect(keeper()).liquidate(2);
      partialLiquidationTime = await getTxTime(provider(), liquidateTxn);
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.near(debt, totalCollateralValue.add(unrealizedTraderPnl), bn(0.000001));
    });
  });

  describe('trader 1 gets fully liquidated', () => {
    before('move forward by a day', async () => {
      await fastForwardTo(partialLiquidationTime + _SECONDS_IN_DAY, provider());
    });

    before('price change', async () => {
      await perpsMarket.aggregator().mockSetCurrentPrice(bn(930));
    });

    before('liquidate trader 1 again', async () => {
      await systems().PerpsMarket.connect(keeper()).liquidate(2);
    });

    let unrealizedTraderPnl: ethers.BigNumber, totalCollateralValue: ethers.BigNumber;
    before('get unrealized trader pnl', async () => {
      const [trader1Pnl] = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      const [trader2Pnl] = await systems().PerpsMarket.getOpenPosition(3, perpsMarket.marketId());
      const [trader3Pnl] = await systems().PerpsMarket.getOpenPosition(4, perpsMarket.marketId());
      totalCollateralValue = await systems().PerpsMarket.totalGlobalCollateralValue();
      unrealizedTraderPnl = trader1Pnl.add(trader2Pnl).add(trader3Pnl);
    });

    it('reports correct debt', async () => {
      const debt = await systems().PerpsMarket.reportedDebt(superMarketId());
      assertBn.near(debt, totalCollateralValue.add(unrealizedTraderPnl), bn(0.000001));
    });

    it('fully liquidated trader 1', async () => {
      const positionData = await systems().PerpsMarket.getOpenPosition(2, perpsMarket.marketId());
      assertBn.equal(positionData.positionSize, bn(0));
    });
  });
});
