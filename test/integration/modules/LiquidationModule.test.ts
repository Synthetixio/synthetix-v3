import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genOneOf, genOrder, genTrader } from '../../generators';
import { depositMargin, commitAndSettle, commitOrder } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

describe('LiquidationModule', () => {
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

      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Commit a new order but don't settle.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 0.5,
        desiredSide: orderSize,
      });
      await commitOrder(bs, marketId, trader, order2);

      // Price falls between 15% and 8.25% should results in a healthFactor of < 1.
      const { answer: marketOraclePrice } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSize === 1 ? 0.9 : 1.1)
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

    it('should recompute funding');

    it('should revert when position already flagged', async () => {
      const { PerpMarketProxy } = systems();

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

      const orderSize: 1 | -1 = genOneOf([1, -1]);
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSize,
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

    it('should revert when accountId does not exist');

    it('should revert when marketId does not exist');
  });

  describe('liquidatePosition', () => {
    it('should liquidate a flagged position');

    it('should liquidate a flagged position even if health > 1');

    it('should partially liquidate if position hits liq window cap');

    it('should update market size and skew upon liquidation');

    it('should update lastLiq{time,utilization}');

    it('should send liqReward to flagger and keeperFee to liquidator');

    it('should send send both fees to flagger if same keeper');

    it('should remove flagger on full liquidation');

    it('should not remove flagger on partial liquidation');

    it('should remove all position collateral from market on liquidation');

    it('should emit all events in correct order');

    it('should recompute funding');

    it('should revert when liq cap has been met');

    it('should revert when position is not flagged');

    it('should revert when no open position or already liquidated');

    it('should revert when accountId does not exist');

    it('should revert when marketId does not exist');
  });
});
