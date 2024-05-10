import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTxTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genAddress,
  genBootstrap,
  genListOf,
  genNumber,
  genOneOf,
  genOrder,
  genSide,
  genSubListOf,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  AVERAGE_SECONDS_PER_YEAR,
  SECONDS_ONE_DAY,
  commitAndSettle,
  commitOrder,
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceData,
  getSusdCollateral,
  getPythPriceDataByMarketId,
  setMarketConfigurationById,
  withExplicitEvmMine,
} from '../../helpers';
import { ethers } from 'ethers';
import { calcFillPrice } from '../../calculations';
import { shuffle } from 'lodash';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const {
    systems,
    restore,
    provider,
    keeper,
    collateralsWithoutSusd,
    markets,
    traders,
    collaterals,
    pool,
  } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should commit order with no existing position', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      const { receipt } = await commitOrder(bs, marketId, trader, order);

      const block = await provider().getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const pendingOrder = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);
      assertBn.equal(pendingOrder.limitPrice, order.limitPrice);
      assertBn.equal(pendingOrder.keeperFeeBufferUsd, order.keeperFeeBufferUsd);
      assertBn.equal(pendingOrder.commitmentTime, timestamp);

      const { orderFee } = await BfpMarketProxy.getOrderFees(
        marketId,
        order.sizeDelta,
        order.keeperFee
      );

      // It's a little weird to get the event that we're asserting. We're doing this to get the correct base fee, anvil
      // have some issue with consistent base fee, which keeperFee is based on.
      const { args: orderCommittedArgs } =
        findEventSafe(receipt, 'OrderCommitted', BfpMarketProxy) || {};

      const orderCommittedEventProperties = [
        trader.accountId,
        marketId,
        timestamp,
        order.sizeDelta,
        orderFee,
        orderCommittedArgs?.estimatedKeeperFee ?? 0,
      ].join(', ');

      await assertEvent(
        receipt,
        `OrderCommitted(${orderCommittedEventProperties})`,
        BfpMarketProxy
      );
    });

    it('should emit all events in correct order');

    it('should revert insufficient margin when margin is less than initial margin', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 100,
      }); // Egregious amount of degenerate leverage.

      // Margin does not meet minMargin req
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'InsufficientMargin()',
        BfpMarketProxy
      );
    });

    it('should revert insufficient margin when margin is less than initial margin due to debt', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarginUsdDepositAmount: 100000,
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
        })
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 6,
      });
      await commitAndSettle(bs, marketId, trader, order);
      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      const orderExpectedToFail = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 20, // TODO it would be nice to figure out a way to make this more precise, depending on market configuration this might revert even without debt
      });
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          orderExpectedToFail.sizeDelta,
          orderExpectedToFail.limitPrice,
          orderExpectedToFail.keeperFeeBufferUsd,
          orderExpectedToFail.hooks
        ),
        'InsufficientMargin()',
        BfpMarketProxy
      );
    });

    it('should revert when an order already present and not yet expired', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      await commitOrder(bs, marketId, trader, order1);

      // Perform another commitment but expect fail as order already exists.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        `OrderFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when order exceeds maxMarketSize (oi)', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      // Update the market's maxMarketSize to be just slightly below sizeDelta. We .abs because order can be short.
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: wei(order.sizeDelta).abs().mul(genNumber(0, 0.99)).toBN(),
      });

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'MaxMarketSizeExceeded()',
        BfpMarketProxy
      );
    });

    it('should be able to set maxMarketSize (oi) to 0 with open positions', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: bn(0),
      });
      const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(marketId);
      assertBn.equal(maxMarketSize, 0);

      // Increasing position fails
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'MaxMarketSizeExceeded()',
        BfpMarketProxy
      );

      // We should still be able to close the position
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order.sizeDelta.mul(-1),
      });
      const { receipt } = await commitAndSettle(bs, marketId, trader, order1);
      await assertEvent(receipt, 'OrderSettled', BfpMarketProxy);
    });

    it('should revert when sizeDelta is 0', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const { limitPrice, keeperFeeBufferUsd, hooks } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      // Perform the commitment (everything valid except for sizeDelta = 0).
      const nilSizeDelta = 0;
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          nilSizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        'NilOrder()',
        BfpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated', async () => {
      const { BfpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      // Position is underwater but not flagged for liquidation.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order1.sizeDelta.mul(-1),
      });
      return assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'CanLiquidatePosition()',
        BfpMarketProxy
      );
    });

    it('should revert when an existing position is flagged for liquidation', async () => {
      const { BfpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 8,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Attempt to commit again. Expect a revert as the position has already flagged.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order1.sizeDelta.mul(-1),
      });
      return assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'PositionFlagged()',
        BfpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const { sizeDelta, limitPrice, keeperFeeBufferUsd, hooks } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      const invalidAccountId = 69420;
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          invalidAccountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        `PermissionDenied("${invalidAccountId}"`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const { sizeDelta, limitPrice, keeperFeeBufferUsd, hooks } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      const invalidMarketId = 69420;
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          invalidMarketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when committing an order for another account', async () => {
      const { BfpMarketProxy } = systems();

      const trader1 = traders()[0];
      const trader2 = traders()[1];

      const { market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: trader1 })
      );
      const { sizeDelta, limitPrice, keeperFeeBufferUsd, hooks } = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount
      );

      // Connected using trader2 for an accountId that belongs to trader1.
      const permission = ethers.utils.formatBytes32String('PERPS_COMMIT_ASYNC_ORDER');
      const signerAddress = await trader2.signer.getAddress();
      await assertRevert(
        BfpMarketProxy.connect(trader2.signer).commitOrder(
          trader1.accountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`,
        BfpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated (but not flagged)', async () => {
      const { BfpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order1);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      // Modify the position (either +/- by 1%)
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(order1.sizeDelta).mul(1.01).toBN(),
      });
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'CanLiquidatePosition()',
        BfpMarketProxy
      );
    });

    it('should revert when an existing position is flagged for liquidation', async () => {
      const { BfpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order1);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Modify the position (either +/- by 1%)
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(order1.sizeDelta).mul(1.01).toBN(),
      });
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'PositionFlagged()',
        BfpMarketProxy
      );
    });

    it('should revert when placing a position into instant liquidation due to post settlement position (concrete)', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: 49250 })
      );
      await market.aggregator().mockSetCurrentPrice(wei(2.5).toBN());
      await setMarketConfigurationById(bs, marketId, {
        skewScale: bn(7_500_000),
        incrementalMarginScalar: bn(1),
        minMarginRatio: bn(0.03),
        maintenanceMarginScalar: bn(0.75),
        liquidationRewardPercent: bn(0.01),
        maxMarketSize: bn(1_000_000),
        makerFee: bn(0.0002),
        takerFee: bn(0.0006),
      });

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        // NOTE: A very specific leverage!
        //
        // The idea of this very specific number is that it would pass the initial margin requirement but still be
        // liquidatable, the really bad skew/fill price.
        desiredLeverage: 14.15,
        desiredSide: 1,
        desiredKeeperFeeBufferUsd: 0,
      });

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'CanLiquidatePosition()',
        BfpMarketProxy
      );
    });

    describe('hooks', () => {
      it('should commit with valid hooks', async () => {
        const { BfpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const { maxHooksPerOrder } = await BfpMarketProxy.getSettlementHookConfiguration();
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
          maxHooksPerOrder,
        });

        const hooks = genSubListOf(
          [SettlementHookMock.address, SettlementHook2Mock.address],
          genNumber(1, 2)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });
        const { receipt } = await commitOrder(bs, marketId, trader, order);

        await assertEvent(receipt, 'OrderCommitted', BfpMarketProxy);
      });

      it('should commit without hooks', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: [],
        });
        const { receipt } = await commitOrder(bs, marketId, trader, order);

        await assertEvent(receipt, 'OrderCommitted', BfpMarketProxy);
      });

      it('should revert when one or more hooks are not whitelisted', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await BfpMarketProxy.getSettlementHookConfiguration();

        // All hooks are invalid - commitment will revert on the first invalid hook.
        const hooks = genListOf(genNumber(1, config.maxHooksPerOrder), genAddress);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          `InvalidHook("${hooks[0]}")`,
          BfpMarketProxy
        );
      });

      it('should revert when any hook is not whitelisted', async () => {
        const { BfpMarketProxy, SettlementHookMock } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await BfpMarketProxy.getSettlementHookConfiguration();

        const numberOfInvalidHooks = genNumber(1, config.maxHooksPerOrder - 2);
        const invalidHooks = genListOf(numberOfInvalidHooks, genAddress);
        const hooks = [SettlementHookMock.address].concat(invalidHooks);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          `InvalidHook("${hooks[1]}")`,
          BfpMarketProxy
        );
      });

      it('should revert when too many hooks are supplied', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await BfpMarketProxy.getSettlementHookConfiguration();
        const hooks = genListOf(config.maxHooksPerOrder + genNumber(1, 10), genAddress);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          'MaxHooksExceeded()',
          BfpMarketProxy
        );
      });
    });
  });

  describe('settleOrder', () => {
    it('should settle an order that exists', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const pendingOrder = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const { orderFee } = await BfpMarketProxy.getOrderFees(
        marketId,
        order.sizeDelta,
        order.keeperFee
      );
      const { tx, receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );
      const block = await provider().getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const { args: orderSettledArgs } =
        findEventSafe(receipt, 'OrderSettled', BfpMarketProxy) || {};
      const orderSettledEventArgs = [
        trader.accountId,
        marketId,
        timestamp,
        order.sizeDelta,
        orderFee,
        orderSettledArgs?.keeperFee ?? 0,
        0, // accruedFunding (zero because no existing open position).
        0, // accruedUtilization (zero because no existing open position).
        0, // pnl.
        order.fillPrice,
        orderFee.add(orderSettledArgs?.keeperFee ?? 0), // debt.
      ].join(', ');
      await assertEvent(tx, `OrderSettled(${orderSettledEventArgs})`, BfpMarketProxy);

      // There should be no order.
      const pendingOrder2 = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(pendingOrder2.sizeDelta);
    });

    it('should settle an order that completely closes existing position', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: -1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      assertBn.equal((await BfpMarketProxy.getMarketDigest(marketId)).size, order.sizeDelta.abs());

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });

      await commitAndSettle(bs, marketId, trader, closeOrder);

      // Market should be empty.
      assertBn.isZero((await BfpMarketProxy.getMarketDigest(marketId)).size);

      // There should be no order.
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // There should no position.
      assertBn.isZero((await BfpMarketProxy.getPositionDigest(trader.accountId, marketId)).size);
    });

    it('should settle an order that partially closes existing', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      // Open new position.
      const orderSide = genSide();
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });
      await commitAndSettle(bs, marketId, trader, order);

      assertBn.equal((await BfpMarketProxy.getMarketDigest(marketId)).size, order.sizeDelta.abs());

      // Partially close position (halving the collateral USD value)
      const partialCloseOrder = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount.div(2),
        {
          desiredSide: orderSide === 1 ? -1 : 1,
          desiredLeverage: 1,
          desiredKeeperFeeBufferUsd: 1,
        }
      );

      await commitAndSettle(bs, marketId, trader, partialCloseOrder);

      const expectedRemainingSize = order.sizeDelta.add(partialCloseOrder.sizeDelta);
      assertBn.equal(
        (await BfpMarketProxy.getMarketDigest(marketId)).size,
        expectedRemainingSize.abs()
      );
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);
      assertBn.equal(
        (await BfpMarketProxy.getPositionDigest(trader.accountId, marketId)).size,
        expectedRemainingSize
      );
    });

    it('should settle an order that adds to an existing order', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      await commitAndSettle(bs, marketId, trader, order1);

      const marketDigest1 = await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.equal(marketDigest1.size, order1.sizeDelta.abs());
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
        desiredSide: order1.sizeDelta.gt(0) ? 1 : -1, // ensure we are adding to the same side.
      });
      await commitAndSettle(bs, marketId, trader, order2);

      const marketDigest2 = await BfpMarketProxy.getMarketDigest(marketId);

      // There should be no order as it settled successfully.
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // Both size and skew should be the sum of order sizeDelta.
      assertBn.equal(marketDigest2.skew.abs(), order1.sizeDelta.abs().add(order2.sizeDelta.abs()));
      assertBn.equal(marketDigest2.size, order1.sizeDelta.abs().add(order2.sizeDelta.abs()));
    });

    it('should settle an order that flips from one side to the other', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      await commitAndSettle(bs, marketId, trader, order1);

      const marketDigest1 = await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.equal(marketDigest1.size, order1.sizeDelta.abs());
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount.mul(2), {
        desiredLeverage: 1,
        desiredSide: order1.sizeDelta.gt(0) ? -1 : 1, // inverse side of order1.
      });
      await commitAndSettle(bs, marketId, trader, order2);

      const marketDigest2 = await BfpMarketProxy.getMarketDigest(marketId);

      // There should be no order as it settled successfully.
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);

      // Skew should be flipped.
      assert(
        (marketDigest1.skew.gt(0) && marketDigest2.skew.lt(0)) ||
          (marketDigest1.skew.lt(0) && marketDigest2.skew.gt(0))
      );
    });

    it('should have a position opened after settlement', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const positionDigest = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.equal(positionDigest.size, order.sizeDelta);
    });

    it('should update market size and skew upon settlement', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const marketDigest = await BfpMarketProxy.getMarketDigest(marketId);
      assertBn.equal(marketDigest.size, order.sizeDelta.abs());
      assertBn.equal(marketDigest.skew, order.sizeDelta);
    });

    it('should handle winning position with debt', async () => {
      const { BfpMarketProxy, USD } = systems();

      const { trader, marketId, collateralDepositAmount, market, collateral } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
          desiredMarginUsdDepositAmount: 50_000,
        })
      );

      // Create some debt by opening and closing a position with a price change.
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      await commitAndSettle(bs, marketId, trader, openOrder);

      // Price change causing 10% loss.
      const newPrice = openOrder.sizeDelta.gt(0)
        ? wei(openOrder.oraclePrice).mul(0.9)
        : wei(openOrder.oraclePrice).mul(1.1);

      await market.aggregator().mockSetCurrentPrice(newPrice.toBN());

      const closeLossOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
      });

      const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeLossOrder);
      const closeEvent = findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy);
      const { totalTraderDebtUsd: totalTraderDebtUsdAfterLoss } =
        await BfpMarketProxy.getMarketDigest(marketId);

      // Assert that we have some debt.
      assertBn.gt(closeEvent.args.accountDebt, 0);
      assertBn.equal(totalTraderDebtUsdAfterLoss, closeEvent.args.accountDebt);

      const { depositedCollaterals } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      const usdCollateralBeforeWinningPos = depositedCollaterals.find(
        (c) => c.collateralAddress === USD.address
      );

      // deposit more collateral to avoid liquidation/ insufficient margin
      await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: collateral,
          desiredMarket: market,
          desiredTrader: trader,
          desiredMarginUsdDepositAmount: closeEvent.args.accountDebt,
        })
      );

      // Now create a winning position and make sure debt is updated.
      const winningOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
      });
      const { receipt: winningOrderReceipt } = await commitAndSettle(
        bs,
        marketId,
        trader,
        winningOrder
      );

      const winningOrderOpenEvent = findEventSafe(
        winningOrderReceipt,
        'OrderSettled',
        BfpMarketProxy
      );
      // Price change causing 50% win.
      const newPrice1 = winningOrder.sizeDelta.gt(0)
        ? wei(winningOrder.oraclePrice).mul(1.5)
        : wei(winningOrder.oraclePrice).mul(0.5);
      await market.aggregator().mockSetCurrentPrice(newPrice1.toBN());

      const closeWinningOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(winningOrder.sizeDelta).mul(-1).toBN(),
      });

      const { receipt: closeWinningReceipt } = await commitAndSettle(
        bs,
        marketId,
        trader,
        closeWinningOrder
      );
      const closeWinningEvent = findEventSafe(closeWinningReceipt, 'OrderSettled', BfpMarketProxy);

      assertBn.isZero(closeWinningEvent.args.accountDebt);

      const { totalTraderDebtUsd } = await BfpMarketProxy.getMarketDigest(marketId);

      const { depositedCollaterals: depositedCollateralsAfter } =
        await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      const usdCollateral = depositedCollateralsAfter.find(
        (c) => c.collateralAddress === USD.address
      );
      const orderFees = wei(winningOrderOpenEvent.args.orderFee).add(
        closeWinningEvent?.args.orderFee
      );
      const keeperFees = wei(winningOrderOpenEvent.args.keeperFee).add(
        closeWinningEvent?.args.keeperFee
      );

      const fees = orderFees.add(keeperFees);
      const expectedUsdCollateralDiff = wei(closeWinningEvent.args.pnl)
        .sub(fees)
        .add(closeWinningEvent.args.accruedFunding)
        .sub(closeWinningEvent.args.accruedUtilization)
        .sub(closeEvent.args.accountDebt);

      const expectedUsdCollateral = wei(usdCollateralBeforeWinningPos!.available).add(
        expectedUsdCollateralDiff
      );

      // The profit is bigger than debt, make sure sUSD collateral gets increased.
      assertBn.near(expectedUsdCollateral.toBN(), usdCollateral!.available, bn(0.001));

      // Make sure totalTraderDebt and accountDebt are decreased.
      assertBn.equal(totalTraderDebtUsd, closeWinningEvent.args.accountDebt);
      assertBn.lt(totalTraderDebtUsd, totalTraderDebtUsdAfterLoss);
    });

    it('should settle order when market price moves between commit/settle but next position still safe', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const orderSide = genSide();
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });

      await commitOrder(bs, marketId, trader, order);

      // Move price by just 1% (but still within realm of safety).
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.99 : 1.01)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      assertBn.equal(
        (await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta,
        order.sizeDelta
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );

      // Order should successfully settle despite the unfavourable price move.
      await assertEvent(receipt, 'OrderSettled', BfpMarketProxy);
      assertBn.isZero((await BfpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);
    });

    enum PositionReductionVariant {
      MODIFY_BELOW_IM = 'MODIFY_BELOW_IM',
      CLOSE_BELOW_IM = 'CLOSE_BELOW_IM',
    }

    forEach([PositionReductionVariant.MODIFY_BELOW_IM, PositionReductionVariant.CLOSE_BELOW_IM]).it(
      'should allow position reduction (%s) even if position is below im',
      async (variant: PositionReductionVariant) => {
        const { BfpMarketProxy } = systems();

        const market = genOneOf(markets());
        const marketId = market.marketId();
        const marketOraclePrice = bn(10_000);
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice);
        const collateral = genOneOf(collateralsWithoutSusd());
        const marginUsdDepositAmount = 10_000;

        const orderSide = genSide();
        const { trader, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            desiredCollateral: collateral,
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Ensure the we are > IM to start off fresh.
        const { im } = await BfpMarketProxy.getLiquidationMarginUsd(
          trader.accountId,
          marketId,
          bn(0)
        );
        const d1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.gt(d1.position.remainingMarginUsd, im);

        // Modify the position to be < IM by changing collateral value. This can also be acheived by moving
        // market price but market price also affects IM so this is a bit easier.
        //
        // `remainingMarginUsd` is basically collateralValueUsd + otherStuff where `otherStuff` is largely
        // negligible at this stage so we can mostly just look at `collateralValueUsd`.
        //
        // Bring the price of collateral down to something that pushes collateralUsd below IM.
        const newCollateralPrice = wei(im).mul(0.95).div(collateralDepositAmount).toBN();
        await collateral.setPrice(newCollateralPrice);

        // Verify that the position margin < IM.
        const d2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        const { im: im2 } = await BfpMarketProxy.getLiquidationMarginUsd(
          trader.accountId,
          marketId,
          bn(0)
        );
        assertBn.lt(d2.position.remainingMarginUsd, im2);

        switch (variant) {
          case PositionReductionVariant.MODIFY_BELOW_IM: {
            // Reduce the position but do not close (reducing or adding by a small amount 5%).
            const desiredSizeDelta = wei(order.sizeDelta).mul(-0.05).toBN();

            const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
              desiredSize: desiredSizeDelta,
            });
            await commitAndSettle(bs, marketId, trader, order2);

            const position = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
            assertBn.equal(position.size, order.sizeDelta.add(desiredSizeDelta));
            break;
          }
          case PositionReductionVariant.CLOSE_BELOW_IM: {
            // Close the entire position.
            const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
              desiredSize: order.sizeDelta.mul(-1),
            });
            await commitAndSettle(bs, marketId, trader, order2);

            const position = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
            assertBn.isZero(position.size);
            break;
          }
          default:
            // Should never reach here but in the case more `PositionReductionVariant` are added.
            throw Error(`Unhandled PositionReductionVariant '${variant}'`);
        }
      }
    );

    it('should emit all events in correct order');

    it('should recompute funding', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt } = await commitAndSettle(bs, marketId, trader, order);

      await assertEvent(receipt, 'FundingRecomputed', BfpMarketProxy);
    });

    it('should add order fees as account debt', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt } = await commitAndSettle(bs, marketId, trader, order);
      const settleEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);
      const accountDigest = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.equal(
        settleEvent?.args.orderFee.add(settleEvent.args.keeperFee),
        accountDigest.debtUsd
      );
    });

    it('should not erroneously override existing debt on settlement', async () => {
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

      // Commit the order.
      await commitOrder(bs, marketId, trader, order3);
      const { publishTime, settlementTime } = await getFastForwardTimestamp(bs, marketId, trader);
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Verify the order exists.
      const orderDigest1 = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(order3.sizeDelta, orderDigest1.sizeDelta);

      // Settle the order.
      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );
      const { orderFee, keeperFee } = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy).args;

      // New debt should be previous debt + keeperFee(s).
      const accountDigest2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.equal(accountDigest2.debtUsd, accountDigest1.debtUsd.add(keeperFee).add(orderFee));
    });

    it('should accurately account for funding when holding for a long time', async () => {
      const { BfpMarketProxy } = systems();
      // Create a static market to make funding assertion easier.
      const market = genOneOf(markets());
      const marketId = market.marketId();
      await setMarketConfigurationById(bs, marketId, {
        maxFundingVelocity: bn(9),
        skewScale: bn(500_000),
        makerFee: bn(0.0002),
        takerFee: bn(0.0006),
      });
      await market.aggregator().mockSetCurrentPrice(bn(100));
      const { collateral, collateralDepositAmount, trader } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarket: market,
          desiredMarginUsdDepositAmount: 100_000,
          // Use USD collateral to make funding assertion easier.
          desiredCollateral: getSusdCollateral(collaterals()),
        })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: bn(1000),
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order);
      const nowS = Math.floor(Date.now() / 1000);
      await fastForwardTo(nowS + SECONDS_ONE_DAY, provider());

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order.sizeDelta.mul(-1),
        desiredKeeperFeeBufferUsd: 0,
      });
      const { receipt } = await commitAndSettle(bs, marketId, trader, closeOrder);
      const { accruedFunding } = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy)?.args ?? {};
      // Funding should not be zero.
      assertBn.lt(accruedFunding, bn(0));
      // Assert that we paid a lot of funding, due to holding our position open for a day.
      assertBn.gt(accruedFunding.mul(-1), bn(800));

      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: bn(1000),
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order2);
      const closeOrder2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order2.sizeDelta.mul(-1),
        desiredKeeperFeeBufferUsd: 0,
      });
      const { receipt: receipt2 } = await commitAndSettle(bs, marketId, trader, closeOrder2);

      const { accruedFunding: accruedFunding2 } =
        findEventSafe(receipt2, 'OrderSettled', BfpMarketProxy)?.args ?? {};

      assertBn.lt(accruedFunding2, bn(0));

      // Assert that we paid tiny amount of funding, since we closed instantly
      assertBn.lt(accruedFunding2.mul(-1), bn(1));
    });

    it('should accurately account for utilization when holding for a long time', async () => {
      const { BfpMarketProxy, Core } = systems();

      const { collateral, collateralDepositAmount, trader, marketId, market } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: genOneOf([1, 2]),
      });
      const { settlementTime } = await commitAndSettle(bs, marketId, trader, order);
      // Fast forward 1 day to accrue some utilization interest.
      await fastForwardTo(settlementTime + SECONDS_ONE_DAY, provider());

      const { utilizationRate } = await BfpMarketProxy.getMarketDigest(marketId);
      const { accruedUtilization } = await BfpMarketProxy.getPositionDigest(
        trader.accountId,
        marketId
      );
      const notionalSize = wei(order.sizeDelta).mul(order.fillPrice).abs();

      const expectedAccruedUtilization = notionalSize
        .mul(wei(utilizationRate).div(AVERAGE_SECONDS_PER_YEAR))
        .mul(SECONDS_ONE_DAY + 1);
      // Asset accrued interest after one day
      assertBn.near(accruedUtilization, expectedAccruedUtilization.toBN(), bn(0.00001));

      const { stakedAmount, staker, stakerAccountId, collateral: stakedCollateral, id } = pool();
      // Unstake 50% of the delegated amount on the core side, this should lead to a increased utilization rate.
      const newDelegated = wei(stakedAmount).mul(0.5).toBN();
      await Core.connect(staker()).delegateCollateral(
        stakerAccountId,
        id,
        stakedCollateral().address,
        newDelegated,
        bn(1)
      );

      const { accruedUtilization: accruedUtilizationBeforeRecompute } =
        await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);

      // Recompute utilization, to get the utlization rate updated due to the un-delegation
      const recomputeTx = await BfpMarketProxy.recomputeUtilization(marketId);
      const recomputeTimestamp = await getTxTime(provider(), recomputeTx);

      const { utilizationRate: newUtilizationRateAfterRecompute } =
        await BfpMarketProxy.getMarketDigest(marketId);

      // Fast forward three days to accrue some utilization interest with the new utilization rate
      const SECONDS_THREE_DAYS = SECONDS_ONE_DAY * 3;
      await fastForwardTo(recomputeTimestamp + SECONDS_THREE_DAYS, provider());

      const { accruedUtilization: accruedUtilizationAfterRecompute } =
        await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);

      const expectedAccruedUtilization1 = notionalSize
        .mul(wei(newUtilizationRateAfterRecompute).div(AVERAGE_SECONDS_PER_YEAR))
        .mul(SECONDS_THREE_DAYS)
        // The accrued interest should include the interest before the recompute as the trader hasn't touched his position
        .add(accruedUtilizationBeforeRecompute);

      assertBn.near(
        accruedUtilizationAfterRecompute,
        expectedAccruedUtilization1.toBN(),
        bn(0.0001)
      );

      const { receipt } = await commitAndSettle(
        bs,
        marketId,
        trader,
        genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: order.sizeDelta.mul(-1),
        })
      );
      const orderSettledEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);
      // The order settled event's accrued utilization should be the same as the accrued utilization after recompute
      assertBn.near(
        accruedUtilizationAfterRecompute,
        orderSettledEvent.args.accruedUtilization,
        bn(0.0001)
      );
    });

    it('should have correct accrued utilization when modifying positions', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, market, marketId, collateralDepositAmount, collateral } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      const { receipt, settlementTime } = await commitAndSettle(bs, marketId, trader, openOrder);
      const event = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);
      assertBn.isZero(event.args.accruedUtilization);
      const fastForwardBy = genNumber(SECONDS_ONE_DAY, SECONDS_ONE_DAY * 10);
      await fastForwardTo(settlementTime + fastForwardBy, provider());

      const { utilizationRate } = await BfpMarketProxy.getMarketDigest(marketId);
      // Keep the position open but flip it to short
      const flipToShortOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(openOrder.sizeDelta).mul(-2).toBN(),
      });

      const { receipt: receipt2 } = await commitAndSettle(bs, marketId, trader, flipToShortOrder);
      const event2 = findEventSafe(receipt2, 'OrderSettled', BfpMarketProxy);
      assertBn.gt(event2.args.accruedUtilization, bn(0));

      const notionalSize = wei(openOrder.sizeDelta).mul(flipToShortOrder.fillPrice).abs();

      const expectedAccruedUtilization = notionalSize.mul(
        wei(utilizationRate).mul(fastForwardBy).div(AVERAGE_SECONDS_PER_YEAR)
      );

      assertBn.near(event2.args.accruedUtilization, expectedAccruedUtilization.toBN(), bn(0.00001));

      // Make sure a new trader gets the correct result too (while the other traders position is still open)
      const {
        trader: trader1,
        collateralDepositAmount: collateralDepositAmount1,
        collateral: collateral1,
      } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value, desiredMarket: market })
      );
      const openOrder1 = await genOrder(bs, market, collateral1, collateralDepositAmount1, {
        desiredLeverage: genNumber(1, 2),
      });

      const { settlementTime: settlementTime1 } = await commitAndSettle(
        bs,
        marketId,
        trader1,
        openOrder1
      );

      const fastForwardBy1 = genNumber(SECONDS_ONE_DAY, SECONDS_ONE_DAY * 10);
      await fastForwardTo(settlementTime1 + fastForwardBy1, provider());

      const { utilizationRate: utilizationRate1 } = await BfpMarketProxy.getMarketDigest(marketId);
      const closeOrder = await genOrder(bs, market, collateral1, collateralDepositAmount1, {
        desiredSize: openOrder1.sizeDelta.mul(-1),
      });
      const { receipt: receipt3 } = await commitAndSettle(bs, marketId, trader1, closeOrder);

      const event3 = findEventSafe(receipt3, 'OrderSettled', BfpMarketProxy);
      const notionalSize1 = wei(openOrder1.sizeDelta).mul(closeOrder.fillPrice).abs();
      const expectedAccruedUtilization1 = notionalSize1.mul(
        wei(utilizationRate1).mul(fastForwardBy1).div(AVERAGE_SECONDS_PER_YEAR)
      );

      assertBn.near(
        event3.args.accruedUtilization,
        expectedAccruedUtilization1.toBN(),
        bn(0.00001)
      );
    });

    it('should realize non-zero sUSD to trader when closing a profitable trade', async () => {
      const { BfpMarketProxy, USD } = systems();

      // Any collateral except sUSD can be used, we want to make sure a non-zero.
      const collateral = genOneOf(collateralsWithoutSusd());
      const { trader, market, marketId, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral })
      );

      // No prior orders or deposits. Must be zero.
      const d0 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(
        d0.depositedCollaterals.filter(
          ({ collateralAddress }) => collateralAddress === USD.address
        )[0].available
      );

      // Open then close order after making a profit.
      const orderSide = genSide();
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });
      await commitAndSettle(bs, marketId, trader, openOrder);

      // Profit with 20% (large enough to cover any fees).
      const newMarketOraclePrice = wei(openOrder.oraclePrice)
        .mul(orderSide === 1 ? 1.2 : 0.8)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide === 1 ? -1 : 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      const d1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

      // sUSD must be gt 0.
      assertBn.gt(
        d1.depositedCollaterals.filter(
          ({ collateralAddress }) => collateralAddress === USD.address
        )[0].available,
        bn(0)
      );

      // Value of original collateral should also stay the same.
      assertBn.equal(
        d1.depositedCollaterals.filter(
          ({ collateralAddress }) => collateralAddress === collateral.address()
        )[0].available,
        collateralDepositAmount
      );
    });

    it('should pay a non-zero settlement fee to keeper', async () => {
      const { BfpMarketProxy, USD } = systems();

      // Any collateral except sUSD can be used, we want to make sure a non-zero.
      const collateral = genOneOf(collateralsWithoutSusd());
      const { trader, market, marketId, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral })
      );

      // No prior orders or deposits. Must be zero.
      const d0 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(
        d0.depositedCollaterals.filter(
          ({ collateralAddress }) => collateralAddress === USD.address
        )[0].available
      );

      // Open then close order after making a profit.
      const orderSide = genSide();
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: orderSide,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 1,
      });
      const { receipt } = await commitAndSettle(bs, marketId, trader, openOrder, {
        desiredKeeper: keeper(),
      });

      const keeperFee = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy)?.args.keeperFee;
      assertBn.gt(keeperFee, bn(0));
      assertBn.equal(await USD.balanceOf(await keeper().getAddress()), keeperFee);
    });

    it('should revert when this order exceeds maxMarketSize (oi)');

    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidAccountId = 69420;
      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(invalidAccountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidMarketId = 420420;
      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(
          trader.accountId,
          invalidMarketId,
          updateData,
          {
            value: updateFee,
          }
        ),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert if not enough time has passed', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's _just_ before readiness.
      const { minOrderAge } = await BfpMarketProxy.getMarketConfiguration();

      // minOrderAge -1 (1s less than minOrderAge) -1 (1s to account for the additional second added after the fact).
      const settlementTime = commitmentTime + genNumber(1, minOrderAge.toNumber() - 2);

      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotReady()`,
        BfpMarketProxy
      );
    });

    it('should revert if order is stale/expired', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's at or after max age.
      const maxOrderAge = (await BfpMarketProxy.getMarketConfiguration()).maxOrderAge.toNumber();
      const settlementTime = commitmentTime + genNumber(maxOrderAge, maxOrderAge * 2);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderStale()`,
        BfpMarketProxy
      );
    });

    it('should revert when there is no pending order', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotFound()`,
        BfpMarketProxy
      );
    });

    forEach(['long', 'short']).it(
      'should revert when side (%s) fillPrice exceeds limitPrice',
      async (side: string) => {
        const { BfpMarketProxy } = systems();

        const orderSide = side === 'long' ? 1 : -1;
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: orderSide,
        });
        await commitOrder(bs, marketId, trader, order);

        // Move price past limitPrice (+/- 30%).
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 1.3 : 0.7)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
        const { updateData, updateFee } = await getPythPriceDataByMarketId(
          bs,
          marketId,
          publishTime
        );

        await fastForwardTo(settlementTime, provider());

        const { skewScale } = await BfpMarketProxy.getMarketConfigurationById(marketId);
        const marketSkew = bn(0);
        const fillPrice = calcFillPrice(
          marketSkew,
          skewScale,
          order.sizeDelta,
          newMarketOraclePrice
        );
        await assertRevert(
          BfpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          `PriceToleranceExceeded("${order.sizeDelta}", "${fillPrice}", "${order.limitPrice}")`,
          BfpMarketProxy
        );
      }
    );

    it('should revert when account can be liquidated due to debt', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, collateralDepositAmount, collateral, market, marketId } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 20% loss.
      const newPrice = openOrder.sizeDelta.gt(0)
        ? wei(openOrder.oraclePrice).mul(0.8)
        : wei(openOrder.oraclePrice).mul(1.2);
      await market.aggregator().mockSetCurrentPrice(newPrice.toBN());

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });

      const { receipt } = await commitAndSettle(bs, marketId, trader, closeOrder);
      const orderSettledEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);

      // Make sure we have some debt.
      const accountDebt = orderSettledEvent.args.accountDebt;
      assertBn.gt(accountDebt, 0);

      // Collateral price where debt is equal to collateralUsd.
      const newCollateralPrice = wei(accountDebt)
        .div(collateralDepositAmount)
        // Add 1% higher, which makes the collateralUsd > debt but the discountedCollateralUsd < debt.
        .mul(1.01);

      await collateral.setPrice(newCollateralPrice.toBN());

      const marginDigest = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);

      // Assert that collateral is bigger than debt but the discounted collateral is smaller.
      assertBn.gt(marginDigest.collateralUsd, accountDebt);
      assertBn.gt(accountDebt, marginDigest.discountedCollateralUsd);

      // Assert we can liquidate margin.
      const canLiqMargin = BfpMarketProxy.isMarginLiquidatable(trader.accountId, marketId);
      assert.ok(canLiqMargin, 'Accounts margin should be liquidatable');

      const failingOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          failingOrder.sizeDelta,
          failingOrder.limitPrice,
          failingOrder.keeperFeeBufferUsd,
          []
        ),
        'InsufficientMargin()',
        BfpMarketProxy
      );
    });

    it('should revert when a second trader causes a extreme skew leading to a bad fill price', async () => {
      const { BfpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
      const market = genOneOf(markets());
      const marketId = market.marketId();

      await market.aggregator().mockSetCurrentPrice(wei(1).toBN());

      // Configure a static realistic market configuration.
      await setMarketConfigurationById(bs, market.marketId(), {
        skewScale: bn(7_500_000),
        maxMarketSize: bn(1_000_000),
        incrementalMarginScalar: bn(1),
        minMarginRatio: bn(0.03),
        maintenanceMarginScalar: bn(0.75),
        liquidationRewardPercent: bn(0.01),
        makerFee: bn(0),
        takerFee: bn(0),
      });

      // One "other" trader creates an order which will create a big skew, the idea here is that the main trader commits before this settles,
      // and we should then expect settle to revert
      const {
        trader: otherTrader,
        collateralDepositAmount: otherCollateralDepositAmount,
        collateral: otherCollateral,
      } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: tradersGenerator.next().value,
          desiredMarket: market,
          desiredMarginUsdDepositAmount: 800_000,
        })
      );
      const otherOrder = await genOrder(bs, market, otherCollateral, otherCollateralDepositAmount, {
        desiredSide: 1,
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 0,
        desiredPriceImpactPercentage: 0.5, // Assume the user doesn't care about price impact.
      });

      // Commit the "other" trader's order, but don't settle it yet.
      await commitOrder(bs, marketId, otherTrader, otherOrder);

      // Now also commit the main trader's order. This order using quite high leverage => which means a bad fill price can put it into liquidation.
      const {
        trader: mainTrader,
        collateralDepositAmount,
        collateral,
      } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: tradersGenerator.next().value,
          desiredMarket: market,
        })
      );
      const mainOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 9,
        desiredSide: 1,
        desiredPriceImpactPercentage: 0.5, // Assume the user doesn't care about price impact.
      });

      await commitOrder(bs, marketId, mainTrader, mainOrder);

      // Now fast forward and settle the "other" trader's order, which will create a big skew.
      const { settlementTime: otherSettlementTime, publishTime: otherPublishTime } =
        await getFastForwardTimestamp(bs, marketId, otherTrader);
      await fastForwardTo(otherSettlementTime, provider());
      const { updateData: otherUpdateData, updateFee: otherUpdateFee } =
        await getPythPriceDataByMarketId(bs, marketId, otherPublishTime);
      await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(keeper()).settleOrder(
            otherTrader.accountId,
            marketId,
            otherUpdateData,
            {
              value: otherUpdateFee,
            }
          ),
        provider()
      );

      // Skew has now changed significantly, we now expect the "main" trader's order to revert,
      // because the skew has changed, leading to an entry price that would be immediately eligible for liquidation.
      const { settlementTime, publishTime } = await getFastForwardTimestamp(
        bs,
        marketId,
        mainTrader
      );
      await fastForwardTo(settlementTime, provider());
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        BfpMarketProxy.connect(keeper()).settleOrder(mainTrader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        'CanLiquidatePosition()',
        BfpMarketProxy
      );
    });

    it('should revert if collateral price slips into maxMarketSize between commit and settle');

    it('should revert when prices from PYTH are zero ', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitOrder(bs, marketId, trader, order);

      const pendingOrder = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const { pythPriceFeedId } = await BfpMarketProxy.getMarketConfigurationById(marketId);
      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);

      const pythPrice = 0;
      const { updateData, updateFee } = await getPythPriceData(
        bs,
        pythPrice,
        pythPriceFeedId,
        publishTime
      );

      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        'InvalidPrice()',
        BfpMarketProxy
      );
    });

    it('should revert when pyth price is stale');

    it('should revert if off-chain pyth publishTime is not within acceptance window');

    it('should revert if pyth vaa merkle/blob is invalid');

    it('should revert when not enough wei is available to pay pyth fee');

    describe('settlementHooks', () => {
      it('should settle and execute committed hooks', async () => {
        const { BfpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await BfpMarketProxy.getSettlementHookConfiguration();
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
          maxHooksPerOrder,
        });
        const hooks = genSubListOf(
          [SettlementHookMock.address, SettlementHook2Mock.address],
          genNumber(1, 2)
        );

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });
        const { receipt } = await commitAndSettle(bs, marketId, trader, order);

        await assertEvent(receipt, 'OrderSettled', BfpMarketProxy);

        for (const hook of hooks) {
          await assertEvent(
            receipt,
            `OrderSettlementHookExecuted(${trader.accountId}, ${marketId}, "${hook}")`,
            BfpMarketProxy
          );
        }
      });

      it('should execute hook with expected data', async () => {
        const { BfpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await BfpMarketProxy.getSettlementHookConfiguration();
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
          maxHooksPerOrder,
        });
        const hooks = [SettlementHookMock.address];

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });
        const { receipt } = await commitAndSettle(bs, marketId, trader, order);

        await assertEvent(receipt, 'OrderSettled', BfpMarketProxy);

        const price = await BfpMarketProxy.getOraclePrice(marketId);
        await assertEvent(
          receipt,
          `OnSettledInvoked(${trader.accountId}, ${marketId}, ${price})`,
          SettlementHookMock
        );
      });

      it('should revert settlement when a hook also reverts', async () => {
        const { BfpMarketProxy, SettlementHookMock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await BfpMarketProxy.getSettlementHookConfiguration();
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address],
          maxHooksPerOrder,
        });
        const hooks = [SettlementHookMock.address];
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });

        await SettlementHookMock.mockSetShouldRevertOnSettlement(true);

        await commitOrder(bs, marketId, trader, order);

        const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
        const { updateData, updateFee } = await getPythPriceDataByMarketId(
          bs,
          marketId,
          publishTime
        );

        await fastForwardTo(settlementTime, provider());

        await assertRevert(
          BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          'InvalidSettlement()',
          BfpMarketProxy
        );
      });

      it('should revert when a hook was removed between commit and settle', async () => {
        const { BfpMarketProxy, SettlementHookMock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await BfpMarketProxy.getSettlementHookConfiguration();
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address],
          maxHooksPerOrder,
        });
        const hooks = [SettlementHookMock.address];
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });

        await commitOrder(bs, marketId, trader, order);

        // Remove the original hook in commit from whitelist.
        await BfpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [],
          maxHooksPerOrder,
        });

        const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
        const { updateData, updateFee } = await getPythPriceDataByMarketId(
          bs,
          marketId,
          publishTime
        );

        await fastForwardTo(settlementTime, provider());

        await assertRevert(
          BfpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          `InvalidHook("${SettlementHookMock.address}")`,
          BfpMarketProxy
        );
      });
    });
  });

  describe('getOrderDigest', () => {
    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const market = genOneOf(markets());
      const invalidAccountId = 42069;

      await assertRevert(
        BfpMarketProxy.getOrderDigest(invalidAccountId, market.marketId()),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.getOrderDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should return default object when accountId/marketId exists but no order', async () => {
      const { BfpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());

      const { sizeDelta } = await BfpMarketProxy.getOrderDigest(
        trader.accountId,
        market.marketId()
      );
      assertBn.isZero(sizeDelta);
    });
  });

  describe('getFillPrice', () => {
    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const invalidMarketId = bn(42069);

      // Size to check fill price
      const size = bn(genNumber(-10, 10));

      await assertRevert(
        BfpMarketProxy.getFillPrice(invalidMarketId, size),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should give premium when increasing skew', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      // Creating a long skew for the market.
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
        desiredSide: 1,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data.
      const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);

      // Using size to simulate short which will reduce the skew.
      const size = bn(genNumber(1, 10));

      const actualFillPrice = await BfpMarketProxy.getFillPrice(marketId, size);

      // To get a "premium" to our long we expect the price to have a premium
      assertBn.gt(actualFillPrice, oraclePrice);
    });

    it('should give discount when reducing skew', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      // Creating a long skew for the market.
      const orderSide = genSide();
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Invert the size 1:1 and bring it back to neutral.
      const fillPrice = await BfpMarketProxy.getFillPrice(marketId, order.sizeDelta.mul(-1));
      const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);

      // To get a discount, we expect longs (invert short) to receive a lower price and shorts
      // (invert long) to receive a higher price.
      if (orderSide === 1) {
        assertBn.gt(fillPrice, oraclePrice);
      } else {
        assertBn.lt(fillPrice, oraclePrice);
      }
    });

    it('should return mark price as fillPrice when size is 0', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data.
      const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);
      const { skewScale } = await BfpMarketProxy.getMarketConfigurationById(marketId);
      const marketSkew = order.sizeDelta;

      // Size to check fill price.
      const size = bn(0);

      const actualFillPrice = await BfpMarketProxy.getFillPrice(marketId, size);
      const expectedFillPrice = wei(1).add(wei(marketSkew).div(skewScale)).mul(oraclePrice).toBN();

      // Using near to avoid rounding errors.
      assertBn.near(expectedFillPrice, actualFillPrice);
    });

    it('should calculate fillPrice (exhaustive)', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data.
      const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);
      const { skewScale } = await BfpMarketProxy.getMarketConfigurationById(marketId);
      const marketSkew = order.sizeDelta;

      // Size to check fill price.
      const size = bn(genNumber(-10, 10));

      const actualFillPrice = await BfpMarketProxy.getFillPrice(marketId, size);
      const expectedFillPrice = calcFillPrice(marketSkew, skewScale, size, oraclePrice);

      assertBn.equal(expectedFillPrice, actualFillPrice);
    });
  });

  describe('getOraclePrice', () => {
    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const invalidMarketId = 42069;
      await assertRevert(
        BfpMarketProxy.getOraclePrice(invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });
  });
});
