import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genOneOf, genOrder, genSide, genTrader } from '../../generators';
import { depositMargin, commitAndSettle, commitOrder } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe.only('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { keeper, systems, restore } = bs;

  beforeEach(restore);

  describe('flagPosition', () => {
    it('should flag a position with a health factor <= 1', async () => {
      const { PerpMarketProxy } = systems();

      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/pumps between 15% and 8.25% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );

      const { healthFactor } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

      assertBn.lte(healthFactor, wei(1).toBN());

      const tx = await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      await assertEvent(
        tx,
        `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${await keeper().getAddress()}")`,
        PerpMarketProxy
      );
    });

    it('should remove any pending orders when present', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Commit a new order but don't settle.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 0.5,
        desiredSide: orderSide,
      });
      await commitOrder(bs, marketId, trader, order2);

      // Price falls between 15% and 8.25% should results in a healthFactor of < 1.
      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      const tx = await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      await assertEvent(
        tx,
        `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${await keeper().getAddress()}")`,
        PerpMarketProxy
      );
      await assertEvent(tx, `OrderCanceled(${trader.accountId}, ${marketId})`, PerpMarketProxy);
    });

    it('should emit all events in correct order');

    it('should revert when position already flagged', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      // First flag should be successful.
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Second flag should fail because already flagged.
      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `PositionFlagged()`,
        PerpMarketProxy
      );
    });

    it('should revert when position health factor > 1', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Position just opened and cannot be liquidated.
      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `CannotLiquidatePosition()`,
        PerpMarketProxy
      );
    });

    it('should revert when no open position', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await depositMargin(bs, genTrader(bs));

      // Position just opened and cannot be liquidated.
      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `PositionNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('liquidatePosition', () => {
    it('should liquidate a flagged position', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const tx = await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
      const keeperAddress = await keeper().getAddress();

      // NOTE: Missing the last two values (liqReward and keeperFee).
      await assertEvent(
        tx,
        `PositionLiquidated(${trader.accountId}, ${marketId}, "${keeperAddress}", "${keeperAddress}"`,
        PerpMarketProxy
      );
    });

    it('should liquidate a flagged position even if health > 1', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );

      const { healthFactor: hf1 } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lt(hf1, wei(1).toBN());
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Price moves back and they're no longer in liquidation but already flagged.
      await market.aggregator().mockSetCurrentPrice(wei(marketOraclePrice).toBN());
      const { healthFactor: hf2 } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.gt(hf2, wei(1).toBN());

      // Attempt the liquidate. This should complete successfully.
      const tx = await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
      const keeperAddress = await keeper().getAddress();

      // NOTE: Missing the last two values (liqReward and keeperFee).
      await assertEvent(
        tx,
        `PositionLiquidated(${trader.accountId}, ${marketId}, "${keeperAddress}", "${keeperAddress}"`,
        PerpMarketProxy
      );
    });

    it('should partially liquidate if position hits liq window cap');

    it('should update market size and skew upon full liquidation', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      const d1 = await PerpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const d2 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.lt(d2.size, d1.size);
      assertBn.lt(d2.skew.abs(), d1.skew.abs());
      assertBn.isZero(d2.size);
      assertBn.isZero(d2.skew);
    });

    it('should update lastLiq{time,utilization}', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      const d1 = await PerpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const d2 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.gt(d2.lastLiquidationTime, d1.lastLiquidationTime);
      assertBn.lt(d2.remainingLiquidatableSizeCapacity, d1.remainingLiquidatableSizeCapacity);
    });

    it('should send liqReward to flagger and keeperFee to liquidator');

    it('should send send both fees to flagger if same keeper');

    it('should remove flagger on full liquidation');

    it('should not remove flagger on partial liquidation');

    it('should remove all position collateral from market on liquidation', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const d1 = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
      const d2 = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      const { collateralUsd } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      assertBn.gt(d1.remainingMarginUsd, d2.remainingMarginUsd);
      assertBn.isZero(d2.remainingMarginUsd);
      assertBn.isZero(collateralUsd);
    });

    it('should emit all events in correct order');

    it('should recompute funding', async () => {
      const { PerpMarketProxy } = systems();

      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/pumps between 15% and 8.25% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      const tx = await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
      await assertEvent(tx, `FundingRecomputed`, PerpMarketProxy);
    });

    it('should revert when liq cap has been met');

    it('should revert when position is not flagged', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation.
      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
          .toBN()
      );

      // Attempt the liquidate. Not flagged, should not liquidate.
      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFlagged()`,
        PerpMarketProxy
      );
    });

    it('should revert when no open position or already liquidated', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await genTrader(bs);
      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });
});
