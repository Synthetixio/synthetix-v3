import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { shuffle } from 'lodash';
import { assertEvents } from '../../assert';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader, toRoundRobinGenerators } from '../../generators';
import {
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceData,
  withExplicitEvmMine,
} from '../../helpers';

describe('OrderModule Cancelations', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, keeper, traders } = bs;

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
        order.keeperFeeBufferUsd
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceData(bs, marketId, publishTime);

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
        order.keeperFeeBufferUsd
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceData(bs, marketId, publishTime);

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

      const { updateData } = await getPythPriceData(bs, marketId, publishTime);

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
        order.keeperFeeBufferUsd
      );
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

      const { updateData } = await getPythPriceData(bs, marketId, publishTime);

      await assertRevert(PerpMarketProxy.cancelOrder(trader.accountId, marketId, updateData), `OrderNotReady()`);
    });

    it('should revert if onchain and pyth price exceeds priceDivergencePercent', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd
      );
      // Retrieve on-chain configuration to generate a Pyth price that's above the divergence.
      const priceDivergencePercent = wei(
        (await PerpMarketProxy.getMarketConfiguration()).priceDivergencePercent
      ).toNumber();
      const oraclePrice = wei(await PerpMarketProxy.getOraclePrice(marketId)).toNumber();

      // Create a Pyth price that is > the oraclePrice +/- 0.001%. Randomly below or above the oracle price.
      //
      // We `parseFloat(xxx.toFixed(3))` to avoid really ugly numbers like 1864.7999999999997 during testing.
      const pythPrice = parseFloat(
        genOneOf([
          oraclePrice * (1.001 + priceDivergencePercent),
          oraclePrice * (0.999 - priceDivergencePercent),
        ]).toFixed(3)
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime, pythPrice);

      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).cancelOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `PriceDivergenceExceeded("${bn(pythPrice)}", "${bn(oraclePrice)}")`,
        PerpMarketProxy
      );
    });
    it('should revert when price update from pyth is invalid');

    it('should revert if stale order is cancelled by non owner', async () => {
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
        order.keeperFeeBufferUsd
      );
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(genNumber(expireTime, expireTime * 2), provider());
      const { updateData } = await getPythPriceData(bs, marketId, publishTime);

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
        order.keeperFeeBufferUsd
      );
      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);
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
        order.keeperFeeBufferUsd
      );
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

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
        [`OrderCanceled(${trader.accountId}, ${marketId}, ${orderDigestBefore.commitmentTime})`],
        PerpMarketProxy
      );
      // We expect no transfer event because the order was cancelled by caller
      assert.throws(() => findEventSafe(receipt, 'Transfer', PerpMarketProxy));
    });
    it('should cancel order if ready and price exceeds tolerance', async () => {
      const { PerpMarketProxy, Core } = systems();
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
        order.keeperFeeBufferUsd
      );

      // Update market price to be outside of tolerance
      await market
        .aggregator()
        .mockSetCurrentPrice(order.sizeDelta.gt(0) ? order.limitPrice.add(1) : order.limitPrice.sub(1));

      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

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

      await assertEvent(
        receipt,
        `OrderCanceled(${trader.accountId}, ${marketId}, ${orderDigestBefore.commitmentTime})`,
        PerpMarketProxy
      );

      const coreUsdWithdrawEvent = findEventSafe(receipt, 'MarketUsdWithdrawn', Core);
      const keeperFee = coreUsdWithdrawEvent!.args.amount;
      const accountDigestAfter = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      assertBn.gt(keeperFee, bn(0)); // assert real value when new settlement keeper fees implemented
      // Make sure accounting for trader reflect the keeper fee
      assertBn.equal(accountDigestBefore.collateralUsd.sub(keeperFee), accountDigestAfter.collateralUsd);
    });

    it('assert all events'); // implement when new settlement keeper fees implemented
  });

  describe('clearStaleOrder', () => {
    it('should revert invalid market id', async () => {
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

      const invalidMarketId = bn(42069);

      await assertRevert(
        PerpMarketProxy.clearStaleOrder(trader.accountId, invalidMarketId),
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
        order.keeperFeeBufferUsd
      );

      const invalidAccountId = bn(42069);

      await assertRevert(PerpMarketProxy.clearStaleOrder(invalidAccountId, marketId), `OrderNotFound()`);
    });

    it('should revert when order does not exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));

      await assertRevert(PerpMarketProxy.clearStaleOrder(trader.accountId, marketId), `OrderNotFound()`);
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
        order.keeperFeeBufferUsd
      );

      await assertRevert(PerpMarketProxy.clearStaleOrder(trader.accountId, marketId), `OrderNotStale()`);
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
        order.keeperFeeBufferUsd
      );
      const { settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(tradersGenerator.next().value.signer).clearStaleOrder(trader.accountId, marketId),
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
        order.keeperFeeBufferUsd
      );
      const { expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const orderDigestBefore = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(orderDigestBefore.sizeDelta, order.sizeDelta);
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(shuffle(traders())[0].signer).clearStaleOrder(trader.accountId, marketId),
        provider()
      );
      const orderDigestAfter = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      await assertEvents(
        receipt,
        [`OrderCanceled(${trader.accountId}, ${marketId}, ${orderDigestBefore.commitmentTime})`],
        PerpMarketProxy
      );
    });
  });
});
