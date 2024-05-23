import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assert from 'assert';
import { shuffle } from 'lodash';
import { BigNumber } from 'ethers';
import { assertEvents } from '../../assert';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  commitAndSettle,
  commitOrder,
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceDataByMarketId,
  isSusdCollateral,
  setBaseFeePerGas,
  setMarketConfiguration,
  withExplicitEvmMine,
} from '../../helpers';
import { calcKeeperCancellationFee } from '../../calculations';

describe('OrderModule Cancelations', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, keeper, traders, collateralsWithoutSusd } = bs;

  beforeEach(restore);

  describe('cancelOrder', () => {
    it('should revert invalid market id', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidMarketId = bn(42069);

      await assertRevert(
        BfpMarketProxy.cancelOrder(trader.accountId, invalidMarketId, updateData),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert invalid account id', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidAccountId = bn(42069);

      await assertRevert(
        BfpMarketProxy.cancelOrder(invalidAccountId, marketId, updateData),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when order does not exists', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await genTrader(bs);
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        BfpMarketProxy.cancelOrder(trader.accountId, marketId, updateData),
        `OrderNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when order not ready', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);

      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        BfpMarketProxy.cancelOrder(trader.accountId, marketId, updateData),
        `OrderNotReady()`,
        BfpMarketProxy
      );
    });

    it('should revert when price update from pyth is invalid');

    it('should revert if price tolerance not exceeded', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);

      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());

      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);
      const fillPrice = await BfpMarketProxy.getFillPrice(marketId, order.sizeDelta);

      await assertRevert(
        BfpMarketProxy.connect(keeper()).cancelOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `PriceToleranceNotExceeded("${order.sizeDelta}", "${fillPrice}", "${order.limitPrice}")`,
        BfpMarketProxy
      );
    });

    it('should allow account owner to cancel a stale order', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      const orderDigestBefore = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assert.equal(orderDigestBefore.isStale, true);

      assertBn.equal(order.sizeDelta, orderDigestBefore.sizeDelta);

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(trader.signer).cancelOrder(
            trader.accountId,
            marketId,
            updateData,
            {
              value: updateFee,
            }
          ),
        provider()
      );

      const orderDigestAfter = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      assert.equal(orderDigestAfter.isStale, false);

      await assertEvents(
        receipt,
        [`OrderCanceled(${trader.accountId}, ${marketId}, 0, ${orderDigestBefore.commitmentTime})`],
        BfpMarketProxy
      );

      // We expect no transfer event because the order was canceled by caller
      assert.throws(() => findEventSafe(receipt, 'Transfer', BfpMarketProxy));
    });

    it('should allow keeper to cancel a stale order', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitOrder(bs, marketId, trader, order);
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      const orderDigestBefore = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assert.equal(orderDigestBefore.isStale, true);

      assertBn.equal(order.sizeDelta, orderDigestBefore.sizeDelta);

      // Set a high base fee to ensure we above minimum keeper fee.
      const baseFee = await setBaseFeePerGas(100, provider());
      const expectedKeeperFee = await calcKeeperCancellationFee(bs, baseFee);
      const signer = keeper();
      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(signer).cancelOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
            maxFeePerGas: BigNumber.from(500 * 1e9), // Specify a large maxFeePerGas so callers can set a high basefee without any problems.
          }),
        provider()
      );

      const orderDigestAfter = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      assert.equal(orderDigestAfter.isStale, false);

      const canceledEvent = findEventSafe(receipt, 'OrderCanceled', BfpMarketProxy);

      assertBn.equal(canceledEvent.args.accountId, trader.accountId);
      assertBn.equal(canceledEvent.args.marketId, marketId);
      assertBn.equal(canceledEvent.args.keeperFee, expectedKeeperFee);
      assertBn.equal(canceledEvent.args.commitmentTime, orderDigestBefore.commitmentTime);

      // Reset base fee
      await setBaseFeePerGas(1, provider());
    });

    it('should cancel order when within settlement window but price exceeds tolerance', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

      // Eliminate skewFee on the non-sUSD collateral sale.
      if (!isSusdCollateral(collateral)) {
        await BfpMarketProxy.setMarginCollateralConfiguration(
          [collateral.address()],
          [collateral.oracleNodeId()],
          [collateral.max],
          [bn(0)], // skewScale
          [collateral.rewardDistributorAddress()]
        );
      }

      const orderSide = genSide();
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredKeeperFeeBufferUsd: 0,
      });

      await commitOrder(bs, marketId, trader, order);

      // Update market price to be outside of tolerance.
      await market
        .aggregator()
        .mockSetCurrentPrice(orderSide === 1 ? order.limitPrice.add(1) : order.limitPrice.sub(1));

      // Fees are calculated against the discounted collateral value. Do not discount the collateral.
      await setMarketConfiguration(bs, {
        minCollateralDiscount: bn(0),
        maxCollateralDiscount: bn(0),
      });

      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      const orderDigestBefore = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(order.sizeDelta, orderDigestBefore.sizeDelta);
      const accountDigestBefore = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).cancelOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );

      const orderDigestAfter = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);
      const accountDigestAfter = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const canceledEvent = findEventSafe(receipt, 'OrderCanceled', BfpMarketProxy);
      const keeperFee = canceledEvent!.args.keeperFee;
      assertBn.gt(keeperFee, bn(0)); // TODO: assert real value when new settlement keeper fees implemented

      await assertEvent(
        receipt,
        `OrderCanceled(${trader.accountId}, ${marketId}, ${keeperFee}, ${orderDigestBefore.commitmentTime})`,
        BfpMarketProxy
      );

      // Make sure accounting for trader reflect the keeper fee.
      assertBn.near(
        // If trader using non sUSD collateral the user will get debt rather than a decrease in collateral.
        accountDigestBefore.collateralUsd.sub(keeperFee).add(accountDigestAfter.debtUsd),
        accountDigestAfter.collateralUsd,
        bn(0.0000001)
      );
    });

    it('should emit all events in correct order');

    it('should not erroneously override existing debt on cancel', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          // Ensure we use non sUSD so the account accrues debt.
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
          desiredMarginUsdDepositAmount: 10_000,
        })
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Incur a loss.
      await market.aggregator().mockSetCurrentPrice(wei(order1.oraclePrice).mul(0.95).toBN());

      // Close with a loss.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order1.sizeDelta.mul(-1),
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order2);

      // Assert there is existing debt.
      const accountDigest1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.gt(accountDigest1.debtUsd, 0);

      // Open an order that we intend to close.
      const order3 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 0,
      });

      // Commit the order, fast forward time so it can be canceled.
      await commitOrder(bs, marketId, trader, order3);
      const { publishTime, expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Verify the order exists.
      const orderDigest1 = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assert.equal(orderDigest1.isStale, true);
      assertBn.equal(order3.sizeDelta, orderDigest1.sizeDelta);

      // Cancel the order and ensure fees are > 0.
      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).cancelOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );
      const { keeperFee } = findEventSafe(receipt, 'OrderCanceled', BfpMarketProxy).args;
      assertBn.gt(keeperFee, 0);

      // New debt should be previous debt + keeperFee.
      const accountDigest2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.equal(accountDigest2.debtUsd, accountDigest1.debtUsd.add(keeperFee));
    });
  });

  describe('cancelStaleOrder', () => {
    it('should revert invalid market id', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const invalidMarketId = bn(42069);
      await assertRevert(
        BfpMarketProxy.cancelStaleOrder(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert invalid account id', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const invalidAccountId = bn(42069);
      await assertRevert(
        BfpMarketProxy.cancelStaleOrder(invalidAccountId, marketId),
        `OrderNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when order does not exists', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));

      await assertRevert(
        BfpMarketProxy.cancelStaleOrder(trader.accountId, marketId),
        `OrderNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when order not ready', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      await assertRevert(
        BfpMarketProxy.cancelStaleOrder(trader.accountId, marketId),
        `OrderNotStale()`,
        BfpMarketProxy
      );
    });

    it('should revert if order not stale', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        BfpMarketProxy.connect(tradersGenerator.next().value.signer).cancelStaleOrder(
          trader.accountId,
          marketId
        ),
        `OrderNotStale()`,
        BfpMarketProxy
      );
    });

    it('should remove stale order', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(expireTime, provider());

      const orderDigestBefore = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(orderDigestBefore.sizeDelta, order.sizeDelta);

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(genOneOf(traders()).signer).cancelStaleOrder(
            trader.accountId,
            marketId
          ),
        provider()
      );

      const orderDigestAfter = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(orderDigestAfter.sizeDelta);

      await assertEvents(
        receipt,
        [`OrderCanceled(${trader.accountId}, ${marketId}, 0, ${orderDigestBefore.commitmentTime})`],
        BfpMarketProxy
      );
    });
  });
});
