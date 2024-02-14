import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bn, bootstrapMarkets } from '../bootstrap';
import { openPosition } from '../helpers';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const MIN_LIQUIDATION_REWARD = wei(100);
const BTC_MARKET_PRICE = wei(10_000);
const ETH_MARKET_PRICE = wei(2000);

describe('Orders - allow size reduction', () => {
  const liqParams = {
    btc: {
      imRatio: wei(0.1),
      minIm: wei(0.05),
      mmScalar: wei(0.5),
      liqRatio: wei(0.0075),
    },
    eth: {
      imRatio: wei(0.1),
      minIm: wei(0.05),
      mmScalar: wei(0.5),
      liqRatio: wei(0.01),
    },
  };

  const liqGuards = {
    minLiquidationReward: wei(MIN_LIQUIDATION_REWARD),
    minKeeperProfitRatioD18: wei(0),
    maxLiquidationReward: wei(10_000),
    maxKeeperScalingRatioD18: wei(1000),
  };

  const { systems, provider, trader1, perpsMarkets, keeper } = bootstrapMarkets({
    synthMarkets: [],
    liquidationGuards: {
      minLiquidationReward: liqGuards.minLiquidationReward.bn,
      minKeeperProfitRatioD18: liqGuards.minKeeperProfitRatioD18.bn,
      maxLiquidationReward: liqGuards.maxLiquidationReward.bn,
      maxKeeperScalingRatioD18: liqGuards.maxKeeperScalingRatioD18.bn,
    },
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'Bitcoin',
        token: 'BTC',
        price: BTC_MARKET_PRICE.toBN(),
        fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: liqParams.btc.imRatio.toBN(),
          minimumInitialMarginRatio: liqParams.btc.minIm.toBN(),
          maintenanceMarginScalar: liqParams.btc.mmScalar.toBN(),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: liqParams.btc.liqRatio.toBN(),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
      {
        requestedMarketId: 51,
        name: 'Ether',
        token: 'ETH',
        price: ETH_MARKET_PRICE.toBN(),
        fundingParams: { skewScale: bn(10_000), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: liqParams.eth.imRatio.toBN(),
          minimumInitialMarginRatio: liqParams.eth.minIm.toBN(),
          maintenanceMarginScalar: liqParams.eth.mmScalar.toBN(),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: liqParams.eth.liqRatio.toBN(),
          maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
          minimumPositionMargin: bn(0),
        },
        settlementStrategy: {
          settlementReward: bn(0),
        },
      },
    ],
    traderAccountIds: [2],
  });

  before('add margin to account', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(5000));
  });

  before('open positions', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarkets()[0].marketId(),
      sizeDelta: bn(5),
      settlementStrategyId: perpsMarkets()[0].strategyId(),
      price: bn(10_000),
    });

    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarkets()[1].marketId(),
      sizeDelta: bn(-3),
      settlementStrategyId: perpsMarkets()[1].strategyId(),
      price: bn(2000),
    });
  });

  before('reduce price so margin is lower than initial margin', async () => {
    await perpsMarkets()[0].aggregator().mockSetCurrentPrice(bn(9_500));
    await perpsMarkets()[1].aggregator().mockSetCurrentPrice(bn(2_040));
  });

  describe('increasing position size', () => {
    it('reverts for btc position', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 50,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(20_000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin`
      );
    });

    it('reverts for eth position', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 51,
            accountId: 2,
            sizeDelta: bn(-1),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(2000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin`
      );
    });
  });

  describe('decreasing position large enough to take the other side of the position', () => {
    it('reverts for btc position', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 50,
            accountId: 2,
            sizeDelta: bn(-9),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(8_000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin`
      );
    });

    it('reverts for eth position', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 51,
            accountId: 2,
            sizeDelta: bn(5),
            settlementStrategyId: perpsMarkets()[1].strategyId(),
            acceptablePrice: bn(2100),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin`
      );
    });
  });

  describe('check requiredMarginForOrder', () => {
    describe('reduce btc by 2', () => {
      it('is only order fees', async () => {
        const [orderFees] = await systems().PerpsMarket.computeOrderFees(50, bn(-2));
        assertBn.equal(
          await systems().PerpsMarket.requiredMarginForOrder(2, 50, bn(-2)),
          orderFees
        );
      });
      describe('fully close eth position', () => {
        it('is only order fees', async () => {
          const [orderFees] = await systems().PerpsMarket.computeOrderFees(50, bn(3));
          assertBn.equal(
            await systems().PerpsMarket.requiredMarginForOrder(2, 51, bn(3)),
            orderFees
          );
        });
      });
    });
  });

  describe('lower positions', () => {
    before('reduce btc by 2', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarkets()[0].marketId(),
        sizeDelta: bn(-2),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: bn(10_000),
      });
    });

    before('close eth position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId: 2,
        keeper: keeper(),
        marketId: perpsMarkets()[1].marketId(),
        sizeDelta: bn(3),
        settlementStrategyId: perpsMarkets()[1].strategyId(),
        price: bn(2000),
      });
    });

    it('reduced btc position', async () => {
      const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(2, 50);
      assertBn.equal(positionSize, bn(3));
    });

    it('reduced eth position', async () => {
      const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(2, 51);
      assertBn.equal(positionSize, 0);
    });
  });
});
