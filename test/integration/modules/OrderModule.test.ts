import { ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genNumber, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  getFastForwardTimestamp,
  getPythPriceData,
  setMarketConfigurationById,
} from '../../helpers';
import { BigNumber } from 'ethers';
import { calcOrderFees, calculateFillPrice } from '../../calculations';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, restore, provider, keeper, collaterals, markets, traders } = bs;

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

      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);
      assertBn.equal(pendingOrder.limitPrice, order.limitPrice);
      assertBn.equal(pendingOrder.keeperFeeBufferUsd, order.keeperFeeBufferUsd);
      assertBn.equal(pendingOrder.commitmentTime, block.timestamp);

      const { orderFee, keeperFee } = await PerpMarketProxy.getOrderFees(marketId, order.sizeDelta, order.keeperFee);

      await assertEvent(
        tx,
        `OrderSubmitted(${trader.accountId}, ${marketId}, ${order.sizeDelta}, ${block.timestamp}, ${orderFee}, ${keeperFee})`,
        PerpMarketProxy
      );
    });

    it('should emit all events in correct order');

    it('should recompute funding');

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

    it('should revert when committing an order for another account', async () => {
      const { PerpMarketProxy } = systems();

      const trader1 = traders()[0];
      const trader2 = traders()[1];

      const { market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: trader1 })
      );
      const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      // Connected using trader2 for an accountId that belongs to trader1.
      const permission = ethers.utils.formatBytes32String('PERPS_COMMIT_ASYNC_ORDER');
      const signerAddress = await trader2.signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(trader2.signer).commitOrder(
          trader1.accountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd
        ),
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`
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
      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const { orderFee, keeperFee } = await PerpMarketProxy.getOrderFees(marketId, order.sizeDelta, order.keeperFee);
      const tx = await PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, [updateData], {
        value: updateFee,
      });

      await assertEvent(
        tx,
        `OrderSettled(${trader.accountId}, ${marketId}, ${order.sizeDelta}, ${orderFee}, ${keeperFee})`,
        PerpMarketProxy
      );

      // There should be no order.
      const pendingOrder2 = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(pendingOrder2.sizeDelta);
    });

    it('should settle an order that completely closes existing position', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: -1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      assertBn.equal((await PerpMarketProxy.getMarketDigest(marketId)).size, order.sizeDelta.abs());

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });

      await commitAndSettle(bs, marketId, trader, closeOrder);

      // Market should be empty.
      assertBn.isZero((await PerpMarketProxy.getMarketDigest(marketId)).size);

      // There should be no order.
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // There should be no order and no position.
      assertBn.isZero((await PerpMarketProxy.getPositionDigest(trader.accountId, marketId)).size);
    });

    it('should settle an order that partially closes existing');

    it('should settle an order that adds to an existing order', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });

      await commitAndSettle(bs, marketId, trader, order1);

      const marketDigest1 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.equal(marketDigest1.size, order1.sizeDelta.abs());
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
        desiredSide: order1.sizeDelta.gt(0) ? 1 : -1, // ensure we are adding to the same side.
      });
      await commitAndSettle(bs, marketId, trader, order2);

      const marketDigest2 = await PerpMarketProxy.getMarketDigest(marketId);

      // There should be no order as it settled successfully.
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // Both size and skew should be the sum of order sizeDelta.
      assertBn.equal(marketDigest2.skew.abs(), order1.sizeDelta.abs().add(order2.sizeDelta.abs()));
      assertBn.equal(marketDigest2.size, order1.sizeDelta.abs().add(order2.sizeDelta.abs()));
    });

    it('should settle an order that flips from one side to the other', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1 });

      await commitAndSettle(bs, marketId, trader, order1);

      const marketDigest1 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.equal(marketDigest1.size, order1.sizeDelta.abs());
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount.mul(2), {
        desiredLeverage: 1,
        desiredSide: order1.sizeDelta.gt(0) ? -1 : 1, // inverse side of order1.
      });
      await commitAndSettle(bs, marketId, trader, order2);

      const marketDigest2 = await PerpMarketProxy.getMarketDigest(marketId);

      // There should be no order as it settled successfully.
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // Skew should be flipped.
      assert(
        (marketDigest1.skew.gt(0) && marketDigest2.skew.lt(0)) || (marketDigest1.skew.lt(0) && marketDigest2.skew.gt(0))
      );
    });

    it('should have a position opened after settlement', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const positionDigest = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.equal(positionDigest.size, order.sizeDelta);
    });

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

    it('should revert when this order exceeds maxMarketSize (oi)');

    it('should revert when an existing position can be liquidated');

    it('should revert when an existing position is flagged for liquidation');

    it('should revert when margin falls below maintenance margin');

    it('should revert when accountId does not exist', async () => {
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
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidAccountId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(invalidAccountId, marketId, [updateData], {
          value: updateFee,
        }),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
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
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidMarketId = 420420;
      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, invalidMarketId, [updateData], {
          value: updateFee,
        }),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should revert if not enough time has passed', async () => {
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

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's _just_ before readiness.
      const config = await PerpMarketProxy.getMarketConfiguration();
      const settlementTime = commitmentTime + genNumber(1, config.minOrderAge.toNumber() - 1);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, [updateData], {
          value: updateFee,
        }),
        `OrderNotReady()`,
        PerpMarketProxy
      );
    });

    it('should revert if order is stale', async () => {
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

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's at or after max age.
      const maxOrderAge = (await PerpMarketProxy.getMarketConfiguration()).maxOrderAge.toNumber();
      const settlementTime = commitmentTime + genNumber(maxOrderAge, maxOrderAge * 2);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, [updateData], {
          value: updateFee,
        }),
        `StaleOrder()`,
        PerpMarketProxy
      );
    });

    it('should revert when there is no pending order', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, [updateData], {
          value: updateFee,
        }),
        `OrderNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert if long exceeds limit price');

    it('should revert if short exceeds limit price');

    it('should revert if collateral price slips into insufficient margin on between commit and settle');

    it('should revert if collateral price slips into maxMarketSize between commit and settle');

    // NOTE: This may not be necessary.
    it('should revert when price deviations exceed threshold');

    it('should revert when price is zero (i.e. invalid)');

    it('should revert when pyth price is stale');

    it('should revert if off-chain pyth publishTime is not within acceptance window');

    it('should revert if pyth vaa merkle/blob is invalid');

    it('should revert when not enough wei is available to pay pyth fee');
  });

  describe('getOrderFees', () => {
    describe('orderFee', () => {
      enum LiquidtyLeader {
        MAKER = 'MAKER',
        TAKER = 'TAKER',
        BOTH = 'BOTH',
      }

      forEach([
        [LiquidtyLeader.MAKER, 'reducing'],
        [LiquidtyLeader.TAKER, 'expanding'],
        [LiquidtyLeader.BOTH, 'reducing then expanding'],
      ]).it('should charge %s fees when %s skew', async (leader: LiquidtyLeader) => {
        const { PerpMarketProxy } = systems();

        const marginUsdDepositAmount = genNumber(5000, 10_000);
        const leverage = 1;

        // TRADER 1:

        // Deposit margin to trader1, create order, commit and settle the order.
        const gTrader = await depositMargin(
          bs,
          genTrader(bs, { desiredMarginUsdDepositAmount: marginUsdDepositAmount })
        );
        const { marketId, market, collateral } = gTrader;
        const order1 = await genOrder(bs, market, collateral, gTrader.collateralDepositAmount, {
          desiredLeverage: leverage,
        });
        await commitAndSettle(bs, marketId, gTrader.trader, order1);

        // TRADER 2:

        const getDesiredMarginUsdDepositAmount = () => {
          switch (leader) {
            // Ensure the margin for the 2nd trade is LESS than the first order to ensure this is a _pure_
            // maker or taker.
            case LiquidtyLeader.MAKER:
            case LiquidtyLeader.TAKER:
              return marginUsdDepositAmount * 0.9;
            // Give the 2nd order _more_ margin so it's able to reduce the skew and then expand other side.
            case LiquidtyLeader.BOTH:
              return marginUsdDepositAmount * 1.5;
          }
        };

        // Deposit an appropriate amount of margin relative to the leader type we're testing against.
        const gTrader2 = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredCollateral: collateral,
            desiredMarginUsdDepositAmount: getDesiredMarginUsdDepositAmount(),
          })
        );

        const getDesiredSize = () => {
          switch (leader) {
            // Maker means we're reducing skew so we wanted to invert the first order. `BOTH` is also the same
            // side as maker because we're reducing skew to zero then expanding into the other direction.
            case LiquidtyLeader.MAKER:
            case LiquidtyLeader.BOTH:
              return order1.sizeDelta.gt(0) ? -1 : 1;
            // Taker means we're expanding skew so we want to keep riding up the same side of the first order.
            case LiquidtyLeader.TAKER:
              return order1.sizeDelta.gt(0) ? 1 : -1;
          }
        };

        // Create an order, ensuring the size is relative to the leader we're testing.
        const order2 = await genOrder(bs, market, collateral, gTrader2.collateralDepositAmount, {
          desiredLeverage: leverage,
          desiredSide: getDesiredSize(),
        });

        // Retrieve fees associated with this new order.
        const { orderFee } = await PerpMarketProxy.getOrderFees(marketId, order2.sizeDelta, BigNumber.from(0));
        const { orderFee: expectedOrderFee } = await calcOrderFees(bs, marketId, order2.sizeDelta);

        assertBn.equal(orderFee, expectedOrderFee);
      });

      it('should charge the appropriate maker/taker fee (concrete)', async () => {
        const { PerpMarketProxy } = systems();

        // Use explicit values to test a concrete example.
        const trader = traders()[0];
        const collateral = collaterals()[0];
        const market = markets()[0];
        const marginUsdDepositAmount = wei(1000).toBN();
        const leverage = 1;
        const keeperFeeBufferUsd = 0;
        const collateralDepositAmount = wei(10).toBN();
        const collateralPrice = wei(100).toBN();
        const marketOraclePrice = wei(1).toBN();
        const makerFee = wei(0.01).toBN();
        const takerFee = wei(0.02).toBN();

        // Update state to reflect explicit values.
        await collateral.aggregator().mockSetCurrentPrice(collateralPrice);
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice);
        const marketId = market.marketId();
        await setMarketConfigurationById(bs, marketId, { makerFee, takerFee });

        await depositMargin(bs, {
          trader,
          traderAddress: await trader.signer.getAddress(),
          market,
          marketId,
          collateral,
          collateralDepositAmount,
          marginUsdDepositAmount,
          collateralPrice,
        });

        // sizeDelta = 10 * 100 / 1 / 1 = 1000
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: leverage,
          desiredSide: 1, // 1 = long, -1 = short
          desiredKeeperFeeBufferUsd: keeperFeeBufferUsd,
        });
        const { orderFee: orderFee1 } = await PerpMarketProxy.getOrderFees(
          marketId,
          order1.sizeDelta,
          BigNumber.from(keeperFeeBufferUsd)
        );
        await commitAndSettle(bs, marketId, trader, order1);

        // There are no other positions in market, this should be charging takerFees.
        // sizeDelta * fillPrice * takerFee
        assertBn.equal(wei(order1.sizeDelta).mul(order1.fillPrice).mul(takerFee).toBN(), orderFee1);

        // Using twice as much margin, create an order.
        //
        // 10 * 2 = 20
        //
        // Then use that to infer marginUsd and then back to sizeDelta.
        //
        // 20 * 100 / 1 / 1 = 2000
        const order2 = await genOrder(bs, market, collateral, collateralDepositAmount.mul(BigNumber.from(2)), {
          desiredLeverage: leverage,
          desiredSide: -1, // 1 = long, -1 = short
          desiredKeeperFeeBufferUsd: keeperFeeBufferUsd,
        });
        const { orderFee: orderFee2 } = await PerpMarketProxy.getOrderFees(
          marketId,
          order2.sizeDelta,
          BigNumber.from(keeperFeeBufferUsd)
        );

        // We know that half of the new order shrinks skew back to 0 (hence makerFee) and the other half increases.
        const makerFeeUsd = wei(order1.sizeDelta.abs()).mul(order2.fillPrice).mul(makerFee);
        const takerFeeUsd = wei(order1.sizeDelta.abs()).mul(order2.fillPrice).mul(takerFee);

        assertBn.equal(orderFee2, makerFeeUsd.add(takerFeeUsd).toBN());
      });
    });

    describe('keeperFee', () => {
      it('should calculate keeper fees proportional to block.baseFee and profit margin');

      it('should cap the keeperFee by its max usd when exceeds ceiling');

      it('should ceil the keeperFee by its min usd when below floor');
    });
  });

  describe('getFillPrice', () => {
    it('should revert invalid market id', async () => {
      const { PerpMarketProxy } = systems();
      const invalidMarketId = wei(42069).toBN();

      // Size to check fill price
      const size = wei(genNumber(0, 10)).toBN();

      assertRevert(PerpMarketProxy.getFillPrice(invalidMarketId, size), `MarketNotFound(${invalidMarketId})`);
    });

    it('should calculate fillPrice correctly', async () => {
      const { PerpMarketProxy } = systems();

      const gTrader = genTrader(bs);

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, gTrader);
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1.1 });

      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { skewScale } = await PerpMarketProxy.getMarketConfigurationById(marketId);
      const marketSkew = order.sizeDelta;

      // Size to check fill price
      const size = wei(genNumber(0, 10)).toBN();

      const actualFillPrice = await PerpMarketProxy.getFillPrice(marketId, size);
      const expectedFillPrice = calculateFillPrice(marketSkew, skewScale, size, oraclePrice);

      assertBn.equal(expectedFillPrice, actualFillPrice);
    });
  });
});
