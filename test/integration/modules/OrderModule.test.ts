import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genOrder, genTrader } from '../../generators';
import { depositMargin, setMarketConfigurationById } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should commit order with no existing position', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      const tx = await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperOrderBufferFeeUsd
      );
      const receipt = await tx.wait();
      const block = await provider().getBlock(receipt.blockNumber);

      // NOTE: Partial match, just to confirm the order was successfully emitted.
      //
      // The last 2 arguments are fees on the order, which is tested separately. `assertRevert`, despite calling `text.match`
      // does not allow a regex expression... so this will have to change in the future.
      await assertEvent(
        tx,
        `OrderSubmitted(${trader.accountId}, ${marketId}, ${order.sizeDelta}, ${block.timestamp}`,
        PerpMarketProxy
      );
    });

    it('should recompute funding on commitment');

    it('should revert when market is paused');

    it('should revert insufficient margin when margin is less than initial margin', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 100 }); // Egregious amount of degenerate leverage.

      // Margin does not meet minMargin req
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperOrderBufferFeeUsd
        ),
        'InsufficientMargin()',
        PerpMarketProxy
      );
    });

    it('should revert when an order already present', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order1.sizeDelta,
        order1.limitPrice,
        order1.keeperOrderBufferFeeUsd
      );

      // Perform another commitment but expect fail as order already exists.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperOrderBufferFeeUsd
        ),
        `OrderFound("${trader.accountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when order exceeds maxMarketSize (oi)', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });

      // Update the market's maxMarketSize to be just slightly below (95%) sizeDelta. We .abs because order can be short.
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: wei(order.sizeDelta).abs().mul(0.95).toBN(),
      });

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperOrderBufferFeeUsd
        ),
        'MaxMarketSizeExceeded()',
        PerpMarketProxy
      );
    });

    it('should revert when sizeDelta is 0', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { limitPrice, keeperOrderBufferFeeUsd } = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Perform the commitment (everything valid except for sizeDelta = 0).
      const nilSizeDelta = 0;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          nilSizeDelta,
          limitPrice,
          keeperOrderBufferFeeUsd
        ),
        'NilOrder()',
        PerpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated');

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { sizeDelta, limitPrice, keeperOrderBufferFeeUsd } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      const invalidAccountId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          invalidAccountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperOrderBufferFeeUsd
        ),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { sizeDelta, limitPrice, keeperOrderBufferFeeUsd } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      const invalidMarketId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          invalidMarketId,
          sizeDelta,
          limitPrice,
          keeperOrderBufferFeeUsd
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('settleOrder', () => {
    it('should settle an order that exists');
    it('should settle an order that completely closes existing position');
    it('should settle an order that partially closes existing');
    it('should settle an order that adds to an existing order');
    it('should settle an order that flips from one side to the other');

    it('should commit order if price moves but still safe');
    it('should allow position reduction even if insufficient unless in liquidation');

    it('should recompute funding on settlement');

    it('should update market size and skew upon settlement');

    it('should pay a non-zero settlement fee to keeper');

    it('should revert when market is paused');
    it('should revert when this order exceeds maxMarketSize (oi)');
    it('should revert when sizeDelta is 0');
    it('should revert when an existing position can be liquidated');
    it('should revert when maxLeverage is exceeded');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
    it('should revert if not enough time has passed');
    it('should revert if order is stale');

    it('should revert if long exceeds limit price');
    it('should revert if short exceeds limit price');

    it('should revert if collateral price slips into insufficient margin on between commit and settle');
    it('should revert if collateral price slips into maxMarketSize between commit and settle');

    // NOTE: This may not be necessary.
    it('should revert when price deviations exceed threshold');

    it('should revert when price is zero (i.e. invalid)');
    it('should revert if off-chain pyth publishTime is not within acceptance window');
    it('should revert if pyth vaa merkle/blob is invalid');
    it('should revert when not enough wei is available to pay pyth fee');
  });

  describe('getOrderFees', () => {});

  describe('getFillPrice', () => {});
});
