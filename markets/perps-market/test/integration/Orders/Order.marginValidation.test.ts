import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bn, bootstrapMarkets } from '../bootstrap';
import {
  calculateFillPrice,
  openPosition,
  requiredMargins,
  getRequiredLiquidationRewardMargin,
} from '../helpers';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const MIN_LIQUIDATION_REWARD = wei(100);

describe('Orders - margin validation', () => {
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

  const { systems, provider, trader1, perpsMarkets, keeper } = bootstrapMarkets({
    synthMarkets: [],
    liquidationGuards: {
      minLiquidationReward: MIN_LIQUIDATION_REWARD.toBN(),
      minKeeperProfitRatioD18: bn(0),
      maxLiquidationReward: bn(500),
      maxKeeperScalingRatioD18: bn(0),
    },
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'Bitcoin',
        token: 'BTC',
        price: bn(10_000),
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
        price: bn(2000),
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
      const { initialMargin, liquidationMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.eth.imRatio,
          minimumInitialMarginRatio: liqParams.eth.minIm,
          maintenanceMarginScalar: liqParams.eth.mmScalar,
          liquidationRewardRatio: liqParams.eth.liqRatio,
        },
        wei(3),
        calculateFillPrice(wei(0), wei(10_000), wei(3), wei(2000)),
        wei(10_000)
      );

      const totalRequiredMargin = initialMargin
        .add(getRequiredLiquidationRewardMargin(liquidationMargin, MIN_LIQUIDATION_REWARD))
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 51, bn(3)),
        totalRequiredMargin.toBN()
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
        `InsufficientMargin("${bn(100)}", "${totalRequiredMargin.toString(18, true)}")`
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
      const { maintenanceMargin: ethMaintMargin, liquidationMargin: ethLiqMargin } =
        requiredMargins(
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

      const { initialMargin: btcInitialMargin, liquidationMargin: btcLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.btc.imRatio,
          minimumInitialMarginRatio: liqParams.btc.minIm,
          maintenanceMarginScalar: liqParams.btc.mmScalar,
          liquidationRewardRatio: liqParams.btc.liqRatio,
        },
        wei(5),
        calculateFillPrice(wei(0), wei(1000), wei(5), wei(10_000)),
        wei(1000)
      );

      const liqReward = getRequiredLiquidationRewardMargin(
        ethLiqMargin.add(btcLiqMargin),
        MIN_LIQUIDATION_REWARD
      );

      const totalRequiredMargin = ethMaintMargin
        .add(btcInitialMargin)
        .add(liqReward)
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 50, bn(5)),
        totalRequiredMargin.toBN()
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
        `InsufficientMargin("${await systems().PerpsMarket.getAvailableMargin(
          2
        )}", "${totalRequiredMargin.toString(18, true)}")`
      );
    });
  });

  describe('openPosition 2 success', () => {
    before('add more margin', async () => {
      await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(1100));
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
      const { maintenanceMargin: ethMaintMargin, liquidationMargin: ethLiqMargin } =
        requiredMargins(
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

      const { initialMargin: btcInitialMargin, liquidationMargin: btcLiqMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.btc.imRatio,
          minimumInitialMarginRatio: liqParams.btc.minIm,
          maintenanceMarginScalar: liqParams.btc.mmScalar,
          liquidationRewardRatio: liqParams.btc.liqRatio,
        },
        wei(10),
        calculateFillPrice(wei(5), wei(1000), wei(5), wei(10_000)),
        wei(1000)
      );

      const liqReward = getRequiredLiquidationRewardMargin(
        ethLiqMargin.add(btcLiqMargin),
        MIN_LIQUIDATION_REWARD
      );

      const totalRequiredMargin = ethMaintMargin
        .add(btcInitialMargin)
        .add(liqReward)
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(2, 50, bn(5)),
        totalRequiredMargin.toBN()
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
        `InsufficientMargin("${await systems().PerpsMarket.getAvailableMargin(
          2
        )}", "${totalRequiredMargin.toString(18, true)}")`
      );
    });
  });
});
