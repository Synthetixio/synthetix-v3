import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import Wei, { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import { depositMargin, commitAndSettle, setBaseFeePerGas } from '../../helpers';
import { calcFlagReward, calcLiquidationKeeperFee } from '../../calculations';
import { PerpMarketConfiguration } from '../../generated/typechain/MarketConfigurationModule';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collateralsWithoutSusd, traders, systems, provider, restore } = bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('getLiquidationMarginUsd', () => {
    const calcImrAndMmr = (size: Wei, marketConfig: PerpMarketConfiguration.DataStructOutput) => {
      const imr = Wei.min(
        size
          .abs()
          .div(marketConfig.skewScale)
          .mul(marketConfig.incrementalMarginScalar)
          .add(marketConfig.minMarginRatio),
        wei(marketConfig.maxInitialMarginRatio)
      );
      const mmr = imr.mul(marketConfig.maintenanceMarginScalar);
      return { imr, mmr };
    };

    it('should revert when invalid marketId', async () => {
      const { BfpMarketProxy } = systems();
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.getLiquidationMarginUsd(0, invalidMarketId, 0),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when invalid accountId', async () => {
      const { BfpMarketProxy } = systems();
      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;
      await assertRevert(
        BfpMarketProxy.getLiquidationMarginUsd(invalidAccountId, marketId, 0),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should return 0 when no position found', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        0
      );

      assertBn.isZero(mm);
      assertBn.isZero(im);
    });

    it('should calculate IM and MM for existing position', async () => {
      const { BfpMarketProxy } = systems();
      const {
        market,
        collateral,
        collateralDepositAmount,
        marketId,
        trader,
        marginUsdDepositAmount,
      } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const baseFeePerGas = await setBaseFeePerGas(0, provider());

      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        0
      );

      // Data for calcs.
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const absSize = wei(order.sizeDelta).abs();
      const notional = absSize.mul(order.oraclePrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(order.oraclePrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should calculate IM and MM for new position', async () => {
      const { BfpMarketProxy } = systems();
      const { market, collateralDepositAmount, marketId, trader, marginUsdDepositAmount } =
        await depositMargin(bs, genTrader(bs));

      const { answer: marketPrice } = await market.aggregator().latestRoundData();
      const desiredLeverage = genNumber(-5, 5);
      const desiredSize = wei(collateralDepositAmount).div(marketPrice).mul(desiredLeverage).toBN();
      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSize
      );

      // Data for calcs.
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const absSize = wei(desiredSize).abs();
      const notional = absSize.mul(marketPrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should calculate IM and MM for modifying a position', async () => {
      const { BfpMarketProxy } = systems();
      const {
        market,
        collateral,
        collateralDepositAmount,
        marketId,
        trader,
        marginUsdDepositAmount,
      } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const desiredSizeDelta = bn(genNumber(-1, 1));
      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSizeDelta
      );

      // Data for calcs
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const size = order.sizeDelta.add(desiredSizeDelta);
      const absSize = wei(size).abs();
      const notional = absSize.mul(marketPrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should cap IMR (and hence IM) by the maxInitialMarginRatio (concrete)', async () => {
      const { BfpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      await collateral.setPrice(bn(50_000));

      const { market, marketId, trader, marginUsdDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarginUsdDepositAmount: 3_000_000_000, // 3b position
          desiredCollateral: collateral,
        })
      );

      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const desiredSizeDelta = wei(marginUsdDepositAmount).div(wei(marketPrice)).neg().toBN(); // 1x short

      const baseFeePerGas = await setBaseFeePerGas(0, provider());

      const { im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSizeDelta
      );

      // Data for calcs
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

      const size = wei(desiredSizeDelta).abs();
      const notional = size.mul(marketPrice);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        size,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        size,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      // Expect the IMR to be at maxInitialMarginRatio cap.
      const imr = wei(marketConfig.maxInitialMarginRatio);
      const expectedIm = notional
        .mul(imr)
        .add(wei(marketConfig.minMarginUsd))
        .add(liqReward)
        .add(flagReward);

      assertBn.equal(im, expectedIm.toBN());
    });

    it('should allow a position to always 1x even when extremely large', async () => {
      const { BfpMarketProxy } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();
      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const trader = genOneOf(traders());

      // 1M per token to avoid exceeding maxAllowable.
      const collateral = genOneOf(collateralsWithoutSusd());
      await collateral.setPrice(bn(1_000_000));

      let accumulatedDepositUsd = wei(0);

      for (let i = 0; i < 10; i++) {
        const desiredMarginUsdDepositAmount = genNumber(420_000_000, 690_000_000);
        const { marginUsdDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarginUsdDepositAmount,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredTrader: trader,
          })
        );
        accumulatedDepositUsd = accumulatedDepositUsd.add(marginUsdDepositAmount);

        const desiredSizeDelta = wei(accumulatedDepositUsd).div(wei(marketPrice)).neg().toBN(); // 1x short
        const { im } = await BfpMarketProxy.getLiquidationMarginUsd(
          trader.accountId,
          marketId,
          desiredSizeDelta
        );

        // Expect the IM to always be below the total deposited margin.
        assertBn.lt(im, accumulatedDepositUsd.toBN());
      }
    });
  });
});
