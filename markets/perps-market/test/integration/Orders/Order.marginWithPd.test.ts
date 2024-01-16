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

const RNDR_PRICE = wei(2.85);
const RNDR_SKEW_SCALE = wei(7_500_000);

describe('Orders - margin validation with p/d', () => {
  const liqParams = {
    imRatio: wei(0.01),
    minIm: wei(0.03),
    mmScalar: wei(0.5),
    liqRatio: wei(0.01),
  };
  const liqGuards = {
    minLiquidationReward: wei(1),
    minKeeperProfitRatioD18: wei(0.01),
    maxLiquidationReward: wei(110),
    maxKeeperScalingRatioD18: wei(10),
  };

  const { systems, provider, trader1, trader2, perpsMarkets, keeper } = bootstrapMarkets({
    liquidationGuards: {
      minLiquidationReward: liqGuards.minLiquidationReward.bn,
      minKeeperProfitRatioD18: liqGuards.minKeeperProfitRatioD18.bn,
      maxLiquidationReward: liqGuards.maxLiquidationReward.bn,
      maxKeeperScalingRatioD18: liqGuards.maxKeeperScalingRatioD18.bn,
    },
    synthMarkets: [],
    perpsMarkets: [
      {
        requestedMarketId: 50,
        name: 'rndr',
        token: 'RNDR',
        price: RNDR_PRICE.toBN(),
        fundingParams: { skewScale: RNDR_SKEW_SCALE.toBN(), maxFundingVelocity: bn(0) },
        liquidationParams: {
          initialMarginFraction: liqParams.imRatio.toBN(),
          minimumInitialMarginRatio: liqParams.minIm.toBN(),
          maintenanceMarginScalar: liqParams.mmScalar.toBN(),
          maxLiquidationLimitAccumulationMultiplier: bn(1),
          liquidationRewardRatio: liqParams.liqRatio.toBN(),
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

  const startingMargin = wei(49_250);
  before('add margin to account', async () => {
    await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(500_000));
    await systems().PerpsMarket.connect(trader2()).modifyCollateral(3, 0, startingMargin.bn);
  });

  before('trader1 opens position', async () => {
    await openPosition({
      systems,
      provider,
      trader: trader1(),
      accountId: 2,
      keeper: keeper(),
      marketId: perpsMarkets()[0].marketId(),
      sizeDelta: bn(250_000),
      settlementStrategyId: perpsMarkets()[0].strategyId(),
      price: bn(2.85),
    });
  });

  describe('trader 2 attempts to open position', () => {
    let orderFees: ethers.BigNumber;
    const newSize = wei(240_000);
    before('get order fees', async () => {
      [orderFees] = await systems().PerpsMarket.computeOrderFees(50, newSize.bn);
    });

    it('reverts if not enough margin', async () => {
      const fillPrice = calculateFillPrice(wei(250_000), RNDR_SKEW_SCALE, newSize, wei(2.85));
      const { initialMargin, liquidationMargin } = requiredMargins(
        {
          initialMarginRatio: liqParams.imRatio,
          minimumInitialMarginRatio: liqParams.minIm,
          maintenanceMarginScalar: liqParams.mmScalar,
          liquidationRewardRatio: liqParams.liqRatio,
        },
        newSize,
        fillPrice,
        RNDR_SKEW_SCALE
      );

      const totalRequiredMargin = initialMargin
        .add(
          getRequiredLiquidationRewardMargin(liquidationMargin, liqGuards, {
            costOfTx: wei(0),
            margin: startingMargin,
          })
        )
        .add(orderFees);

      assertBn.equal(
        await systems().PerpsMarket.requiredMarginForOrder(3, 50, newSize.bn),
        totalRequiredMargin.toBN()
      );

      const availableMargin = startingMargin.add(
        expectedStartingPnl(RNDR_PRICE, fillPrice, newSize)
      );

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader2())
          .commitOrder({
            marketId: 50,
            accountId: 3,
            sizeDelta: bn(240_000),
            settlementStrategyId: perpsMarkets()[0].strategyId(),
            acceptablePrice: bn(4),
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        `InsufficientMargin("${availableMargin.toBN()}", "${totalRequiredMargin.bn}")`
      );
    });
  });
});
