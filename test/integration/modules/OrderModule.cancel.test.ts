import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assert from 'assert';
import { shuffle } from 'lodash';
import { assertEvents } from '../../assert';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceData,
  getPythPriceDataByMarketId,
  isSusdCollateral,
  setMarketConfiguration,
  withExplicitEvmMine,
} from '../../helpers';

describe('OrderModule Cancelations', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, keeper, traders, spotMarket } = bs;

  beforeEach(restore);

  describe('cancelOrder', () => {
    it('should revert invalid market id', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidMarketId = bn(42069);

      await assertRevert(
        PerpMarketProxy.cancelOrder(trader.accountId, invalidMarketId, updateData),
        `MarketNotFound("${invalidMarketId}")`
      );
    });

    it('should revert invalid account id', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidAccountId = bn(42069);

      await assertRevert(
        PerpMarketProxy.cancelOrder(invalidAccountId, marketId, updateData),
        `AccountNotFound("${invalidAccountId}")`
      );
    });

    it('should revert when order does not exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await genTrader(bs);
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(PerpMarketProxy.cancelOrder(trader.accountId, marketId, updateData), `OrderNotFound()`);
    });

    it('should revert when order not ready', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(PerpMarketProxy.cancelOrder(trader.accountId, marketId, updateData), `OrderNotReady()`);
    });

    it('should revert when price update from pyth is invalid');

    it('should revert if stale order is canceled by non owner', async () => {
      const { PerpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(genNumber(expireTime, expireTime * 2), provider());
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        PerpMarketProxy.connect(tradersGenerator.next().value.signer).cancelOrder(
          trader.accountId,
          marketId,
          updateData
        ),
        `OrderStale()`
      );
    });

    it('should revert if price tolerance not exceeded', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
      const fillPrice = await PerpMarketProxy.getFillPrice(marketId, order.sizeDelta);
      await assertRevert(
        PerpMarketProxy.connect(keeper()).cancelOrder(trader.accountId, marketId, updateData, { value: updateFee }),
        `PriceToleranceNotExceeded("${order.sizeDelta}", "${fillPrice}", "${order.limitPrice}")`
      );
    });

    it('should cancel order if order is stale and caller is trader', async () => {
      const { PerpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      const orderDigestBefore = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(order.sizeDelta, orderDigestBefore.sizeDelta);
      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(trader.signer).cancelOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );
      const orderDigestAfter = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);

      await assertEvents(
        receipt,
        [`OrderCanceled(${trader.accountId}, ${marketId}, 0, ${orderDigestBefore.commitmentTime})`],
        PerpMarketProxy
      );

      // We expect no transfer event because the order was canceled by caller
      assert.throws(() => findEventSafe(receipt, 'Transfer', PerpMarketProxy));
    });

    it('should cancel order when within settlement window but price exceeds tolerance', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

      // Eliminate skewFee on the non-sUSD collateral sale.
      if (!isSusdCollateral(collateral)) {
        await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(collateral.synthMarketId(), bn(0));
      }

      const orderSide = genSide();
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredKeeperFeeBufferUsd: 0,
      });

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      // Update market price to be outside of tolerance.
      await market
        .aggregator()
        .mockSetCurrentPrice(orderSide === 1 ? order.limitPrice.add(1) : order.limitPrice.sub(1));

      // Fees are calculated against the discounted collateral value. Do not discount the collateral.
      await setMarketConfiguration(bs, { minCollateralDiscount: bn(0), maxCollateralDiscount: bn(0) });

      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      const orderDigestBefore = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(order.sizeDelta, orderDigestBefore.sizeDelta);
      const accountDigestBefore = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(keeper()).cancelOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );

      const orderDigestAfter = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      const accountDigestAfter = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const canceledEvent = findEventSafe(receipt, 'OrderCanceled', PerpMarketProxy);
      const keeperFee = canceledEvent!.args.keeperFee;
      assertBn.gt(keeperFee, bn(0)); // TODO: assert real value when new settlement keeper fees implemented

      await assertEvent(
        receipt,
        `OrderCanceled(${trader.accountId}, ${marketId}, ${keeperFee}, ${orderDigestBefore.commitmentTime})`,
        PerpMarketProxy
      );

      // Make sure accounting for trader reflect the keeper fee.
      assertBn.near(accountDigestBefore.collateralUsd.sub(keeperFee), accountDigestAfter.collateralUsd, bn(0.0000001));
    });

    it('should emit all events in correct order');
  });

  describe('cancelStaleOrder', () => {
    it('should revert invalid market id', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      const invalidMarketId = bn(42069);

      await assertRevert(
        PerpMarketProxy.cancelStaleOrder(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`
      );
    });

    it('should revert invalid account id', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      const invalidAccountId = bn(42069);

      await assertRevert(PerpMarketProxy.cancelStaleOrder(invalidAccountId, marketId), `OrderNotFound()`);
    });

    it('should revert when order does not exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));

      await assertRevert(PerpMarketProxy.cancelStaleOrder(trader.accountId, marketId), `OrderNotFound()`);
    });

    it('should revert when order not ready', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );

      await assertRevert(PerpMarketProxy.cancelStaleOrder(trader.accountId, marketId), `OrderNotStale()`);
    });

    it('should revert if order not stale', async () => {
      const { PerpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(tradersGenerator.next().value.signer).cancelStaleOrder(trader.accountId, marketId),
        `OrderNotStale()`
      );
    });

    it('should remove stale order', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd,
        order.hooks
      );
      const { expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const orderDigestBefore = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(orderDigestBefore.sizeDelta, order.sizeDelta);
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(genOneOf(traders()).signer).cancelStaleOrder(trader.accountId, marketId),
        provider()
      );
      const orderDigestAfter = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      await assertEvents(
        receipt,
        [`OrderCanceled(${trader.accountId}, ${marketId}, 0, ${orderDigestBefore.commitmentTime})`],
        PerpMarketProxy
      );
    });
  });
});
