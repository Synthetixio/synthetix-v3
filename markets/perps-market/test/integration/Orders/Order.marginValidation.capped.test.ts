import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bn, bootstrapMarkets } from '../bootstrap';
import {
  calculateFillPrice,
  openPosition,
  requiredMargins,
  getRequiredLiquidationRewardMargin,
  expectedStartingPnl,
} from '../helpers';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const BTC_MARKET_PRICE = wei(10_000);
const ETH_MARKET_PRICE = wei(2000);

describe('Orders - capped margin validation', () => {
  const liqParams = {
    btc: {
      imRatio: wei(0.02),
      minIm: wei(0.01),
      mmScalar: wei(0.5),
      liqRatio: wei(0.0075),
    },
    eth: {
      imRatio: wei(0.02),
      minIm: wei(0.01),
      mmScalar: wei(0.5),
      liqRatio: wei(0.01),
    },
  };
  const liqGuards = {
    minLiquidationReward: wei(1),
    minKeeperProfitRatioD18: wei(0.01),
    maxLiquidationReward: wei(110),
    maxKeeperScalingRatioD18: wei(10),
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
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(100));
  });

  describe('openPosition 1 failure', () => {
    let orderFees: ethers.BigNumber;
    before('get order fees', async () => {
      [orderFees] = await systems().PerpsMarket.computeOrderFees(51, 3);
    });

    it('reverts if not enough margin', async () => {
      const fillPrice = calculateFillPrice(wei(0), wei(10_000), wei(3), ETH_MARKET_PRICE);
      const { initialMargin, liquidationMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.eth.imRatio,
          minimumInitialMarginRatio: liqParams.eth.minIm,
          maintenanceMarginScalar: liqParams.eth.mmScalar,
          liquidationRewardRatio: liqParams.eth.liqRatio,
        },
        wei(3),
        fillPrice,
        wei(10_000)
      );

      const totalRequiredMargin = initialMargin
        .add(
          getRequiredLiquidationRewardMargin(liquidationMargin, liqGuards, {
            costOfTx: wei(0),
            margin: wei(100),
          })
        )
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 51, bn(3)),
        totalRequiredMargin.toBN()
      );

      const availableMargin = wei(100).add(
        expectedStartingPnl(ETH_MARKET_PRICE, fillPrice, wei(3))
      );

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 51,
            accountId: 2,
            sizeDelta: bn(3),
            settlementStrategyId: perpsMarkets()[1].strategyId(),
            acceptablePrice: bn(3000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin("${availableMargin.toBN()}", "${totalRequiredMargin.toString(
          18,
          true
        )}")`
      );
    });
  });

  describe('openPosition 1 success', () => {
    before('add more margin', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(100));
    });

    before('open position', async () => {
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

    it('opens position', async () => {
      const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(
        2,
        perpsMarkets()[1].marketId()
      );
      assertBn.equal(positionSize, bn(3));
    });
  });

  describe('openPosition 2 failure', () => {
    let orderFees: ethers.BigNumber;
    before('get order fees', async () => {
      [orderFees] = await systems().PerpsMarket.computeOrderFees(50, 5);
    });

    it('reverts if not enough margin', async () => {
      // previous order margins
      const { initialMargin: ethInitialMargin, liquidationMargin: ethLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.eth.imRatio,
          minimumInitialMarginRatio: liqParams.eth.minIm,
          maintenanceMarginScalar: liqParams.eth.mmScalar,
          liquidationRewardRatio: liqParams.eth.liqRatio,
        },
        wei(3),
        wei(2000),
        wei(10_000)
      );

      const fillPrice = calculateFillPrice(wei(0), wei(1000), wei(5), BTC_MARKET_PRICE);
      const { initialMargin: btcInitialMargin, liquidationMargin: btcLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.btc.imRatio,
          minimumInitialMarginRatio: liqParams.btc.minIm,
          maintenanceMarginScalar: liqParams.btc.mmScalar,
          liquidationRewardRatio: liqParams.btc.liqRatio,
        },
        wei(5),
        fillPrice,
        wei(1000)
      );

      const liqReward = getRequiredLiquidationRewardMargin(
        ethLiqMargin.add(btcLiqMargin),
        liqGuards,
        {
          costOfTx: wei(0),
          margin: wei(200),
        }
      );

      const totalRequiredMargin = ethInitialMargin
        .add(btcInitialMargin)
        .add(liqReward)
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 50, bn(5)),
        totalRequiredMargin.toBN()
      );

      const currentAvailableMargin = await systems().PerpsMarket.getAvailableMargin(2);
      const availableMargin = wei(currentAvailableMargin).add(
        expectedStartingPnl(BTC_MARKET_PRICE, fillPrice, wei(5))
      );

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 50,
            accountId: 2,
            sizeDelta: bn(5),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(11000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin("${availableMargin.toBN()}", "${totalRequiredMargin.toString(
          18,
          true
        )}")`
      );
    });
  });

  describe('openPosition 2 success', () => {
    before('add more margin', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(900));
    });

    before('open position', async () => {
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
    });

    it('opens position', async () => {
      const [, , positionSize] = await systems().PerpsMarket.getOpenPosition(2, 50);
      assertBn.equal(positionSize, bn(5));
    });
  });

  describe('modify position', () => {
    let orderFees: ethers.BigNumber;
    before('get order fees', async () => {
      [orderFees] = await systems().PerpsMarket.computeOrderFees(50, 5);
    });

    it('reverts if not enough margin', async () => {
      // previous order margins
      const { initialMargin: ethInitialMargin, liquidationMargin: ethLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.eth.imRatio,
          minimumInitialMarginRatio: liqParams.eth.minIm,
          maintenanceMarginScalar: liqParams.eth.mmScalar,
          liquidationRewardRatio: liqParams.eth.liqRatio,
        },
        wei(3),
        wei(2000),
        wei(10_000)
      );

      const fillPrice = calculateFillPrice(wei(5), wei(1000), wei(5), BTC_MARKET_PRICE);
      const { initialMargin: btcInitialMargin, liquidationMargin: btcLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.btc.imRatio,
          minimumInitialMarginRatio: liqParams.btc.minIm,
          maintenanceMarginScalar: liqParams.btc.mmScalar,
          liquidationRewardRatio: liqParams.btc.liqRatio,
        },
        wei(10),
        fillPrice,
        wei(1000)
      );

      const liqReward = getRequiredLiquidationRewardMargin(
        ethLiqMargin.add(btcLiqMargin),
        liqGuards,
        {
          costOfTx: wei(0),
          margin: wei(200 + 900),
        }
      );

      const totalRequiredMargin = ethInitialMargin
        .add(btcInitialMargin)
        .add(liqReward)
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 50, bn(5)),
        totalRequiredMargin.toBN()
      );

      const currentAvailableMargin = await systems().PerpsMarket.getAvailableMargin(2);
      const availableMargin = wei(currentAvailableMargin).add(
        expectedStartingPnl(BTC_MARKET_PRICE, fillPrice, wei(10))
      );

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .commitOrder({
            marketId: 50,
            accountId: 2,
            sizeDelta: bn(5),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(11000),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin("${availableMargin.toBN()}", "${totalRequiredMargin.toString(
          18,
          true
        )}")`
      );
    });
  });
});
