import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genInt, genOrder, genTrader } from '../../generators';
import { commitAndSettle, depositMargin, getPythPriceData, setMarketConfigurationById } from '../../helpers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, keeper } = bs;

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
        order.keeperFeeBufferUsd
      );
      const receipt = await tx.wait();
      const block = await provider().getBlock(receipt.blockNumber);

      const pendingOrder = await PerpMarketProxy.getOrder(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);
      assertBn.equal(pendingOrder.limitPrice, order.limitPrice);
      assertBn.equal(pendingOrder.keeperFeeBufferUsd, order.keeperFeeBufferUsd);
      assertBn.equal(pendingOrder.commitmentTime, block.timestamp);

      // TODO: Add full event match to include all propertie when events are more finalsied.
      await assertEvent(
        tx,
        `OrderSubmitted(${trader.accountId}, ${marketId}, ${order.sizeDelta}, ${block.timestamp}`,
        PerpMarketProxy
      );
    });

    it('should emit all events in correct order');
    it('should recompute funding');

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
          order.keeperFeeBufferUsd
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
        order1.keeperFeeBufferUsd
      );

      // Perform another commitment but expect fail as order already exists.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd
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
          order.keeperFeeBufferUsd
        ),
        'MaxMarketSizeExceeded()',
        PerpMarketProxy
      );
    });

    it('should revert when sizeDelta is 0', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { limitPrice, keeperFeeBufferUsd } = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Perform the commitment (everything valid except for sizeDelta = 0).
      const nilSizeDelta = 0;
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          nilSizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        'NilOrder()',
        PerpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated');

    it('should revert when an existing position is flagged for liquidation');

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
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
          keeperFeeBufferUsd
        ),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
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
          keeperFeeBufferUsd
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('settleOrder', () => {
    it('should settle an order that exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd
      );
      const pendingOrder = await PerpMarketProxy.getOrder(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const commitmentTime = pendingOrder.commitmentTime.toNumber();
      const config = await PerpMarketProxy.getMarketConfiguration();
      const minOrderAge = config.minOrderAge.toNumber();
      const pythPublishTimeMin = config.pythPublishTimeMin.toNumber();
      const pythPublishTimeMax = config.pythPublishTimeMax.toNumber();

      // PublishTime is allowed to be between settlement + [0, maxAge - minAge]. For example, `[0, 12 - 8] = [0, 4]`.
      const publishTimeDelta = genInt(0, pythPublishTimeMax - pythPublishTimeMin);
      const settlementTime = commitmentTime + minOrderAge;
      const publishTime = settlementTime - publishTimeDelta;

      const oraclePrice = wei(await PerpMarketProxy.getOraclePrice(marketId)).toNumber();
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, oraclePrice, publishTime);

      await fastForwardTo(settlementTime, provider());

      const tx = await PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, [updateData], {
        value: updateFee,
      });

      // TODO: Add full event match to include all propertie when events are more finalsied.
      await assertEvent(tx, `OrderSettled(${trader.accountId}, ${marketId}, ${order.sizeDelta}`, PerpMarketProxy);

      // There should be no order.
      const pendingOrder2 = await PerpMarketProxy.getOrder(trader.accountId, marketId);
      assertBn.equal(pendingOrder2.sizeDelta, 0);
    });

    it('should settle an order that completely closes existing position');
    it('should settle an order that partially closes existing');
    it('should settle an order that adds to an existing order');
    it('should settle an order that flips from one side to the other');

    it('should have a position opened after settlement');

    it('should update market size and skew upon settlement', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const marketDigest = await PerpMarketProxy.getMarketDigest(marketId);
      assertBn.equal(marketDigest.size, order.sizeDelta.abs());
      assertBn.equal(marketDigest.skew, order.sizeDelta);
    });

    it('should commit order when price moves but new position still safe');
    it('should allow position reduction even if insufficient unless in liquidation');

    it('should emit all events in correct order');
    it('should recompute funding');

    it('should pay sUSD to trader when closing a profitable trade');

    it('should pay a non-zero settlement fee to keeper');

    it('should revert when market is paused');
    it('should revert when this order exceeds maxMarketSize (oi)');
    it('should revert when sizeDelta is 0');
    it('should revert when an existing position can be liquidated');
    it('should revert when an existing position is flagged for liquidation');
    it('should revert when margin falls below maintenance margin');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
    it('should revert if not enough time has passed');
    it('should revert if order is stale');
    it('should revert when there is no pending order');

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

  describe('getOrderFees', () => {
    describe('orderFee', () => {
      it('should charger maker fees when reducing skew');

      it('should charge taker fee when expanding skew');

      it('should charge a combination of maker and taker when skew flips');
    });

    describe('keeperFee', () => {
      it('should calculate keeper fees proportional to block.baseFee and profit margin');
    });
  });

  describe('getFillPrice', () => {});
});
