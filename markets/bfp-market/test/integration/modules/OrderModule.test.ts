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
  SYNTHETIX_USD_MARKET_ID,
  commitAndSettle,
  commitOrder,
  depositMargin,
  findEventSafe,
  getFastForwardTimestamp,
  getPythPriceData,
  getSusdCollateral,
  getPythPriceDataByMarketId,
  setMarketConfiguration,
  setMarketConfigurationById,
  withExplicitEvmMine,
} from '../../helpers';
import { BigNumber, ethers } from 'ethers';
import { calcFillPrice, calcOrderFees } from '../../calculations';
import { PerpMarketProxy } from '../../generated/typechain';
import { shuffle } from 'lodash';

describe('OrderModule', () => {
  const bs = bootstrap(genBootstrap());
  const {
    systems,
    restore,
    provider,
    keeper,
    spotMarket,
    ethOracleNode,
    collateralsWithoutSusd,
    markets,
    traders,
    collaterals,
    pool,
  } = bs;

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should commit order with no existing position', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            order.hooks
          ),
        provider()
      );

      const block = await provider().getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);
      assertBn.equal(pendingOrder.limitPrice, order.limitPrice);
      assertBn.equal(pendingOrder.keeperFeeBufferUsd, order.keeperFeeBufferUsd);
      assertBn.equal(pendingOrder.commitmentTime, timestamp);

      const { orderFee } = await PerpMarketProxy.getOrderFees(
        marketId,
        order.sizeDelta,
        order.keeperFee
      );

      // It's a little weird to get the event that we're asserting. We're doing this to get the correct base fee, anvil
      // have some issue with consistent base fee, which keeperFee is based on.
      const { args: orderCommittedArgs } =
        findEventSafe(receipt, 'OrderCommitted', PerpMarketProxy) || {};

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
        PerpMarketProxy
      );
    });

    it('should emit all events in correct order');

    it('should revert insufficient margin when margin is less than initial margin', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 100,
      }); // Egregious amount of degenerate leverage.

      // Margin does not meet minMargin req
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'InsufficientMargin()',
        PerpMarketProxy
      );
    });

    it('should revert insufficient margin when margin is less than initial margin due to debt', async () => {
      const { PerpMarketProxy } = systems();

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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          orderExpectedToFail.sizeDelta,
          orderExpectedToFail.limitPrice,
          orderExpectedToFail.keeperFeeBufferUsd,
          orderExpectedToFail.hooks
        ),
        'InsufficientMargin()',
        PerpMarketProxy
      );
    });

    it('should revert when an order already present and not yet expired', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order1.sizeDelta,
        order1.limitPrice,
        order1.keeperFeeBufferUsd,
        []
      );

      // Perform another commitment but expect fail as order already exists.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        `OrderFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when order exceeds maxMarketSize (oi)', async () => {
      const { PerpMarketProxy } = systems();

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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'MaxMarketSizeExceeded()',
        PerpMarketProxy
      );
    });

    it('should be able to set maxMarketSize (oi) to 0 with open positions', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: bn(0),
      });
      const { maxMarketSize } = await PerpMarketProxy.getMarketConfigurationById(marketId);
      assertBn.equal(maxMarketSize, 0);

      // Increasing position fails
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'MaxMarketSizeExceeded()',
        PerpMarketProxy
      );

      // We should still be able to close the position
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order.sizeDelta.mul(-1),
      });
      const { receipt } = await commitAndSettle(bs, marketId, trader, order1);
      await assertEvent(receipt, 'OrderSettled', PerpMarketProxy);
    });

    it('should revert when sizeDelta is 0', async () => {
      const { PerpMarketProxy } = systems();
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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          nilSizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        'NilOrder()',
        PerpMarketProxy
      );
    });

    it('should revert when an existing position can be liquidated', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([1000, 3000, 5000]) })
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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'CanLiquidatePosition()',
        PerpMarketProxy
      );
    });

    it('should revert when an existing position is flagged for liquidation', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([1000, 3000, 5000]) })
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

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Attempt to commit again. Expect a revert as the position has already flagged.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: order1.sizeDelta.mul(-1),
      });
      return assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'PositionFlagged()',
        PerpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          invalidAccountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        `PermissionDenied("${invalidAccountId}"`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
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
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          invalidMarketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
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
        PerpMarketProxy.connect(trader2.signer).commitOrder(
          trader1.accountId,
          marketId,
          sizeDelta,
          limitPrice,
          keeperFeeBufferUsd,
          hooks
        ),
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`
      );
    });

    it('should revert when an existing position can be liquidated (but not flagged)', async () => {
      const { PerpMarketProxy } = systems();

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

      const { healthFactor } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      // Modify the position (either +/- by 1%)
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(order1.sizeDelta).mul(1.01).toBN(),
      });
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'CanLiquidatePosition()'
      );
    });

    it('should revert when an existing position is flagged for liquidation', async () => {
      const { PerpMarketProxy } = systems();

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

      const { healthFactor } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Modify the position (either +/- by 1%)
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(order1.sizeDelta).mul(1.01).toBN(),
      });
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order2.sizeDelta,
          order2.limitPrice,
          order2.keeperFeeBufferUsd,
          order2.hooks
        ),
        'PositionFlagged()'
      );
    });

    it('should revert when placing a position into instant liquidation due to post settlement position (concrete)', async () => {
      const { PerpMarketProxy } = systems();

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
        desiredLeverage: 14.2,
        desiredSide: 1,
        desiredKeeperFeeBufferUsd: 0,
      });

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        ),
        'CanLiquidatePosition()'
      );
    });

    describe('hooks', () => {
      it('should commit with valid hooks', async () => {
        const { PerpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const { maxHooksPerOrder } = await PerpMarketProxy.getSettlementHookConfiguration();
        await PerpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address, SettlementHook2Mock.address],
          maxHooksPerOrder,
        });
        const hooks = genSubListOf(
          [SettlementHookMock.address, SettlementHook2Mock.address],
          genNumber(1, 2)
        );

        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).commitOrder(
              trader.accountId,
              marketId,
              order.sizeDelta,
              order.limitPrice,
              order.keeperFeeBufferUsd,
              hooks
            ),
          provider()
        );
        await assertEvent(receipt, 'OrderCommitted', PerpMarketProxy);
      });

      it('should commit without hooks', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).commitOrder(
              trader.accountId,
              marketId,
              order.sizeDelta,
              order.limitPrice,
              order.keeperFeeBufferUsd,
              []
            ),
          provider()
        );
        await assertEvent(receipt, 'OrderCommitted', PerpMarketProxy);
      });

      it('should revert when one or more hooks are not whitelisted', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await PerpMarketProxy.getSettlementHookConfiguration();

        // All hooks are invalid - commitment will revert on the first invalid hook.
        const hooks = genListOf(genNumber(1, config.maxHooksPerOrder), genAddress);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          `InvalidHook("${hooks[0]}")`,
          PerpMarketProxy
        );
      });

      it('should revert when any hook is not whitelisted', async () => {
        const { PerpMarketProxy, SettlementHookMock } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await PerpMarketProxy.getSettlementHookConfiguration();

        const numberOfInvalidHooks = genNumber(1, config.maxHooksPerOrder - 2);
        const invalidHooks = genListOf(numberOfInvalidHooks, genAddress);
        const hooks = [SettlementHookMock.address].concat(invalidHooks);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          `InvalidHook("${hooks[1]}")`,
          PerpMarketProxy
        );
      });

      it('should revert when too many hooks are supplied', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);

        const config = await PerpMarketProxy.getSettlementHookConfiguration();
        const hooks = genListOf(config.maxHooksPerOrder + genNumber(1, 10), genAddress);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).commitOrder(
            trader.accountId,
            marketId,
            order.sizeDelta,
            order.limitPrice,
            order.keeperFeeBufferUsd,
            hooks
          ),
          'MaxHooksExceeded()',
          PerpMarketProxy
        );
      });
    });
  });

  describe('settleOrder', () => {
    it('should settle an order that exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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
      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const { orderFee } = await PerpMarketProxy.getOrderFees(
        marketId,
        order.sizeDelta,
        order.keeperFee
      );
      const { tx, receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );
      const block = await provider().getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const { args: orderSettledArgs } =
        findEventSafe(receipt, 'OrderSettled', PerpMarketProxy) || {};
      const orderSettledEventProperties = [
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
        0, // debt.
      ].join(', ');
      await assertEvent(tx, `OrderSettled(${orderSettledEventProperties})`, PerpMarketProxy);

      // There should be no order.
      const pendingOrder2 = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.isZero(pendingOrder2.sizeDelta);
    });

    it('should settle an order that completely closes existing position', async () => {
      const { PerpMarketProxy } = systems();

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

      // There should no position.
      assertBn.isZero((await PerpMarketProxy.getPositionDigest(trader.accountId, marketId)).size);
    });

    it('should settle an order that partially closes existing', async () => {
      const { PerpMarketProxy } = systems();

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

      assertBn.equal((await PerpMarketProxy.getMarketDigest(marketId)).size, order.sizeDelta.abs());

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
        (await PerpMarketProxy.getMarketDigest(marketId)).size,
        expectedRemainingSize.abs()
      );
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);
      assertBn.equal(
        (await PerpMarketProxy.getPositionDigest(trader.accountId, marketId)).size,
        expectedRemainingSize
      );
    });

    it('should settle an order that adds to an existing order', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

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

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });

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
        (marketDigest1.skew.gt(0) && marketDigest2.skew.lt(0)) ||
          (marketDigest1.skew.lt(0) && marketDigest2.skew.gt(0))
      );
    });

    it('should have a position opened after settlement', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const positionDigest = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.equal(positionDigest.size, order.sizeDelta);
    });

    it('should update market size and skew upon settlement', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order);

      const marketDigest = await PerpMarketProxy.getMarketDigest(marketId);
      assertBn.equal(marketDigest.size, order.sizeDelta.abs());
      assertBn.equal(marketDigest.skew, order.sizeDelta);
    });

    it('should update totalTraderDebtUsd and account debt when settling a winning position', async () => {
      const { PerpMarketProxy } = systems();

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
      const closeEvent = findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy);
      const { totalTraderDebtUsd: totalTraderDebtUsdAfterLoss } =
        await PerpMarketProxy.getMarketDigest(marketId);

      // Assert that we have some debt.
      assertBn.gt(closeEvent.args.accountDebt, 0);
      assertBn.equal(totalTraderDebtUsdAfterLoss, closeEvent.args.accountDebt);

      const { depositedCollaterals } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      const usdCollateralBeforeWinningPos = depositedCollaterals.find((c) =>
        c.synthMarketId.eq(SYNTHETIX_USD_MARKET_ID)
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
      await commitAndSettle(bs, marketId, trader, winningOrder);

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
      const closeWinningEvent = findEventSafe(closeWinningReceipt, 'OrderSettled', PerpMarketProxy);

      assertBn.isZero(closeWinningEvent.args.accountDebt);

      const { totalTraderDebtUsd } = await PerpMarketProxy.getMarketDigest(marketId);

      const { depositedCollaterals: depositedCollateralsAfter } =
        await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      const usdCollateral = depositedCollateralsAfter.find((c) =>
        c.synthMarketId.eq(SYNTHETIX_USD_MARKET_ID)
      );
      // The profit is bigger than debt, make sure sUSD collateral gets increased.
      assertBn.gt(usdCollateral!.available, usdCollateralBeforeWinningPos!.available);

      // Make sure totalTraderDebt and accountDebt are decreased.
      assertBn.equal(totalTraderDebtUsd, closeWinningEvent.args.accountDebt);
      assertBn.lt(totalTraderDebtUsd, totalTraderDebtUsdAfterLoss);
    });

    it('should settle order when market price moves between commit/settle but next position still safe', async () => {
      const { PerpMarketProxy } = systems();

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
        (await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta,
        order.sizeDelta
      );

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
        provider()
      );

      // Order should successfully settle despite the unfavourable price move.
      await assertEvent(receipt, 'OrderSettled', PerpMarketProxy);
      assertBn.isZero((await PerpMarketProxy.getOrderDigest(trader.accountId, marketId)).sizeDelta);
    });

    enum PositionReductionVariant {
      MODIFY_BELOW_IM = 'MODIFY_BELOW_IM',
      CLOSE_BELOW_IM = 'CLOSE_BELOW_IM',
    }

    forEach([PositionReductionVariant.MODIFY_BELOW_IM, PositionReductionVariant.CLOSE_BELOW_IM]).it(
      'should allow position reduction (%s) even if position is below im',
      async (variant: PositionReductionVariant) => {
        const { PerpMarketProxy } = systems();

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
        const { im } = await PerpMarketProxy.getLiquidationMarginUsd(trader.accountId, marketId);
        const d1 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
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
        const d2 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        const { im: im2 } = await PerpMarketProxy.getLiquidationMarginUsd(
          trader.accountId,
          marketId
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

            const position = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
            assertBn.equal(position.size, order.sizeDelta.add(desiredSizeDelta));
            break;
          }
          case PositionReductionVariant.CLOSE_BELOW_IM: {
            // Close the entire position.
            const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
              desiredSize: order.sizeDelta.mul(-1),
            });
            await commitAndSettle(bs, marketId, trader, order2);

            const position = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
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
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt } = await commitAndSettle(bs, marketId, trader, order);

      await assertEvent(receipt, 'FundingRecomputed', PerpMarketProxy);
    });

    it('should accurately account for funding when holding for a long time', async () => {
      const { PerpMarketProxy } = systems();
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
      const { accruedFunding } =
        findEventSafe(receipt, 'OrderSettled', PerpMarketProxy)?.args ?? {};
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
        findEventSafe(receipt2, 'OrderSettled', PerpMarketProxy)?.args ?? {};

      assertBn.lt(accruedFunding2, bn(0));
      // Assert that we paid a tiny amount of funding, since we closed instantly
      assertBn.lt(accruedFunding2.mul(-1), bn(1));
    });

    it('should accurately account for utilization when holding for a long time', async () => {
      const { PerpMarketProxy, Core } = systems();

      const { collateral, collateralDepositAmount, trader, marketId, market } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: genOneOf([1, 2]),
      });
      const { settlementTime } = await commitAndSettle(bs, marketId, trader, order);
      // Fast-forward 1 day to accrue some utilization interest.
      await fastForwardTo(settlementTime + SECONDS_ONE_DAY, provider());

      const { utilizationRate } = await PerpMarketProxy.getMarketDigest(marketId);
      const { accruedUtilization } = await PerpMarketProxy.getPositionDigest(
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
        await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      // Recompute utilization, to get the utlization rate updated due to the un-delegation
      const recomputeTx = await PerpMarketProxy.recomputeUtilization(marketId);
      const recomputeTimestamp = await getTxTime(provider(), recomputeTx);

      const { utilizationRate: newUtilizationRateAfterRecompute } =
        await PerpMarketProxy.getMarketDigest(marketId);

      // Fast-forward three days to accrue some utilization interest with the new utilization rate
      const SECONDS_THREE_DAYS = SECONDS_ONE_DAY * 3;
      await fastForwardTo(recomputeTimestamp + SECONDS_THREE_DAYS, provider());

      const { accruedUtilization: accruedUtilizationAfterRecompute } =
        await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

      const expectedAccruedUtilization1 = notionalSize
        .mul(wei(newUtilizationRateAfterRecompute).div(AVERAGE_SECONDS_PER_YEAR))
        .mul(SECONDS_THREE_DAYS)
        // The accrued interest should include the interest before the recomputing as the trader hasn't touched his position
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
      const orderSettledEvent = findEventSafe(receipt, 'OrderSettled', PerpMarketProxy);
      // The order settled event's accrued utilization should be the same as the accrued utilization after recomputing
      assertBn.near(
        accruedUtilizationAfterRecompute,
        orderSettledEvent.args.accruedUtilization,
        bn(0.0001)
      );
    });

    it('should have correct accrued utilization when modifying positions', async () => {
      const { PerpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const { trader, market, marketId, collateralDepositAmount, collateral } = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt, settlementTime } = await commitAndSettle(bs, marketId, trader, openOrder);
      const event = findEventSafe(receipt, 'OrderSettled', PerpMarketProxy);
      assertBn.isZero(event.args.accruedUtilization);
      const fastForwardBy = genNumber(SECONDS_ONE_DAY, SECONDS_ONE_DAY * 10);
      await fastForwardTo(settlementTime + fastForwardBy, provider());

      const { utilizationRate } = await PerpMarketProxy.getMarketDigest(marketId);
      // Keep the position open but flip it to short
      const flipToShortOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-2),
      });

      const { receipt: receipt2 } = await commitAndSettle(bs, marketId, trader, flipToShortOrder);
      const event2 = findEventSafe(receipt2, 'OrderSettled', PerpMarketProxy);
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
      const openOrder1 = await genOrder(bs, market, collateral1, collateralDepositAmount1);

      const { settlementTime: settlementTime1 } = await commitAndSettle(
        bs,
        marketId,
        trader1,
        openOrder1
      );

      const fastForwardBy1 = genNumber(SECONDS_ONE_DAY, SECONDS_ONE_DAY * 10);
      await fastForwardTo(settlementTime1 + fastForwardBy1, provider());

      const { utilizationRate: utilizationRate1 } = await PerpMarketProxy.getMarketDigest(marketId);
      const closeOrder = await genOrder(bs, market, collateral1, collateralDepositAmount1, {
        desiredSize: openOrder1.sizeDelta.mul(-1),
      });
      const { receipt: receipt3 } = await commitAndSettle(bs, marketId, trader1, closeOrder);

      const event3 = findEventSafe(receipt3, 'OrderSettled', PerpMarketProxy);
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
      const { PerpMarketProxy } = systems();

      // Any collateral except sUSD can be used, we want to make sure a non-zero.
      const collateral = genOneOf(collateralsWithoutSusd());
      const { trader, market, marketId, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral })
      );

      // No prior orders or deposits. Must be zero.
      const d0 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(
        d0.depositedCollaterals.filter(({ synthMarketId }) =>
          synthMarketId.eq(SYNTHETIX_USD_MARKET_ID)
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

      const d1 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      // sUSD must be gt 0.
      assertBn.gt(
        d1.depositedCollaterals.filter(({ synthMarketId }) =>
          synthMarketId.eq(SYNTHETIX_USD_MARKET_ID)
        )[0].available,
        bn(0)
      );

      // Value of original collateral should also stay the same.
      assertBn.equal(
        d1.depositedCollaterals.filter(({ synthMarketId }) =>
          synthMarketId.eq(collateral.synthMarketId())
        )[0].available,
        collateralDepositAmount
      );
    });

    it('should pay a non-zero settlement fee to keeper', async () => {
      const { PerpMarketProxy, USD } = systems();

      // Any collateral except sUSD can be used, we want to make sure a non-zero.
      const collateral = genOneOf(collateralsWithoutSusd());
      const { trader, market, marketId, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral })
      );

      // No prior orders or deposits. Must be zero.
      const d0 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(
        d0.depositedCollaterals.filter(({ synthMarketId }) =>
          synthMarketId.eq(SYNTHETIX_USD_MARKET_ID)
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

      const keeperFee = findEventSafe(receipt, 'OrderSettled', PerpMarketProxy)?.args.keeperFee;
      assertBn.gt(keeperFee, bn(0));
      assertBn.equal(await USD.balanceOf(await keeper().getAddress()), keeperFee);
    });

    describe('SpotMarket.sellExactIn', () => {
      it.skip('should revert when sale exceeds sellExactInMaxSlippagePercent', async () => {
        const { PerpMarketProxy, SpotMarket } = systems();

        // TODO: Mint Token X, set as wrapper, wrap token X to push skew.

        const collateral = genOneOf(collateralsWithoutSusd());
        const { trader, market, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: collateral, desiredMarginUsdDepositAmount: 100_000 })
        );

        const orderSide = genSide();
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: orderSide,
          desiredLeverage: 1,
          desiredKeeperFeeBufferUsd: 1,
        });
        await commitAndSettle(bs, marketId, trader, order1);

        // A low slippage tolerance results in a revert on the position modify.
        await setMarketConfiguration(bs, {
          sellExactInMaxSlippagePercent: bn(0.00001),
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });
        await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
          collateral.synthMarketId(),
          bn(1_000_000)
        );

        // Price moves by 50% and they incur a loss.
        const newMarketOraclePrice = wei(order1.oraclePrice)
          .mul(orderSide === 1 ? 0.5 : 1.5)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Add 0.1% more size to the position.
        const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(order1.sizeDelta).mul(0.001).toBN(),
        });
        await commitOrder(bs, marketId, trader, order2);

        const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
        const { updateData, updateFee } = await getPythPriceDataByMarketId(
          bs,
          marketId,
          publishTime
        );
        await fastForwardTo(settlementTime, provider());

        await assertRevert(
          PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          'InsufficientAmountReceived',
          PerpMarketProxy
        );
      });

      describe('open', () => {
        it('should not sell any margin when opening a new position');
      });

      describe('modify', () => {
        it('should sell some non-sUSD synths to pay fees on when no sUSD margin');

        it('should realize sUSD profit when modifying a profitable position');

        it('should sell margin when modifying a neg pnl position (when no sUSD)');

        it('should not sell margin when enough sUSD margin covers neg pnl');

        it('should not sell margin on a profitable position even if fees > pnl');
      });

      describe('close', () => {
        it('should not sell margin when closing a profitable position');

        it('should sell margin when closing a neg pnl position');
      });
    });

    it('should revert when this order exceeds maxMarketSize (oi)');

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidAccountId = 69420;
      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(invalidAccountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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

      const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await fastForwardTo(settlementTime, provider());

      const invalidMarketId = 420420;
      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(
          trader.accountId,
          invalidMarketId,
          updateData,
          {
            value: updateFee,
          }
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should revert if not enough time has passed', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's _just_ before readiness.
      const { minOrderAge } = await PerpMarketProxy.getMarketConfiguration();

      // minOrderAge -1 (1s less than minOrderAge) -1 (1s to account for the additional second added after the fact).
      const settlementTime = commitmentTime + genNumber(1, minOrderAge.toNumber() - 2);

      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotReady()`,
        PerpMarketProxy
      );
    });

    it('should revert if order is stale/expired', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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

      const { commitmentTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      // Fast forward block.timestamp but make sure it's at or after max age.
      const maxOrderAge = (await PerpMarketProxy.getMarketConfiguration()).maxOrderAge.toNumber();
      const settlementTime = commitmentTime + genNumber(maxOrderAge, maxOrderAge * 2);
      await fastForwardTo(settlementTime, provider());

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderStale()`,
        PerpMarketProxy
      );
    });

    it('should revert when there is no pending order', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const { publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
      const { updateData, updateFee } = await getPythPriceDataByMarketId(bs, marketId, publishTime);

      await assertRevert(
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        `OrderNotFound()`,
        PerpMarketProxy
      );
    });

    forEach(['long', 'short']).it(
      'should revert when side (%s) fillPrice exceeds limitPrice',
      async (side: string) => {
        const { PerpMarketProxy } = systems();

        const orderSide = side === 'long' ? 1 : -1;
        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: orderSide,
        });

        await PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        );

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

        const { skewScale } = await PerpMarketProxy.getMarketConfigurationById(marketId);
        const marketSkew = bn(0);
        const fillPrice = calcFillPrice(
          marketSkew,
          skewScale,
          order.sizeDelta,
          newMarketOraclePrice
        );
        await assertRevert(
          PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          `PriceToleranceExceeded("${order.sizeDelta}", "${fillPrice}", "${order.limitPrice}")`,
          PerpMarketProxy
        );
      }
    );

    it('should revert when a second trader causes a extreme skew leading to a bad fill price', async () => {
      const { PerpMarketProxy } = systems();
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
          PerpMarketProxy.connect(keeper()).settleOrder(
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
        PerpMarketProxy.connect(keeper()).settleOrder(mainTrader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        'CanLiquidatePosition()'
      );
    });

    it('should revert if collateral price slips into maxMarketSize between commit and settle');

    it('should revert when prices from PYTH are zero ', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
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
      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      const { pythPriceFeedId } = await PerpMarketProxy.getMarketConfigurationById(marketId);
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
        PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
          value: updateFee,
        }),
        'InvalidPrice()',
        PerpMarketProxy
      );
    });

    it('should revert when pyth price is stale');

    it('should revert if off-chain pyth publishTime is not within acceptance window');

    it('should revert if pyth vaa merkle/blob is invalid');

    it('should revert when not enough wei is available to pay pyth fee');

    describe('hooks', () => {
      it('should settle and execute committed hooks', async () => {
        const { PerpMarketProxy, SettlementHookMock, SettlementHook2Mock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await PerpMarketProxy.getSettlementHookConfiguration();
        await PerpMarketProxy.setSettlementHookConfiguration({
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

        await assertEvent(receipt, 'OrderSettled', PerpMarketProxy);

        for (const hook of hooks) {
          await assertEvent(
            receipt,
            `OrderSettlementHookExecuted(${trader.accountId}, ${marketId}, "${hook}")`,
            PerpMarketProxy
          );
        }
      });

      // TODO: Implement this when data sent as part of the hook is more concretely defined.
      it('should execute hook with expected data');

      it('should revert settlement when a hook also reverts', async () => {
        const { PerpMarketProxy, SettlementHookMock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await PerpMarketProxy.getSettlementHookConfiguration();
        await PerpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address],
          maxHooksPerOrder,
        });
        const hooks = [SettlementHookMock.address];
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });

        await SettlementHookMock.mockSetShouldRevertOnSettlement(true);

        await PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        );

        const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
        const { updateData, updateFee } = await getPythPriceDataByMarketId(
          bs,
          marketId,
          publishTime
        );

        await fastForwardTo(settlementTime, provider());

        await assertRevert(
          PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          'InvalidSettlement()',
          PerpMarketProxy
        );
      });

      it('should revert when a hook was removed between commit and settle', async () => {
        const { PerpMarketProxy, SettlementHookMock } = systems();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const { maxHooksPerOrder } = await PerpMarketProxy.getSettlementHookConfiguration();
        await PerpMarketProxy.setSettlementHookConfiguration({
          whitelistedHookAddresses: [SettlementHookMock.address],
          maxHooksPerOrder,
        });
        const hooks = [SettlementHookMock.address];
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredHooks: hooks,
        });

        await PerpMarketProxy.connect(trader.signer).commitOrder(
          trader.accountId,
          marketId,
          order.sizeDelta,
          order.limitPrice,
          order.keeperFeeBufferUsd,
          order.hooks
        );

        // Remove the original hook in commit from whitelist.
        await PerpMarketProxy.setSettlementHookConfiguration({
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
          PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, updateData, {
            value: updateFee,
          }),
          `InvalidHook("${SettlementHookMock.address}")`,
          PerpMarketProxy
        );
      });
    });
  });

  describe('getOrderDigest', () => {
    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const market = genOneOf(markets());
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getOrderDigest(invalidAccountId, market.marketId()),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.getOrderDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should return default object when accountId/marketId exists but no order', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());

      const { sizeDelta } = await PerpMarketProxy.getOrderDigest(
        trader.accountId,
        market.marketId()
      );
      assertBn.isZero(sizeDelta);
    });
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
        const { orderFee } = await PerpMarketProxy.getOrderFees(marketId, order2.sizeDelta, bn(0));
        const { orderFee: expectedOrderFee } = await calcOrderFees(
          bs,
          marketId,
          order2.sizeDelta,
          order2.keeperFeeBufferUsd
        );

        assertBn.equal(orderFee, expectedOrderFee);
      });

      it('should charge the appropriate maker/taker fee (concrete)', async () => {
        const { PerpMarketProxy } = systems();

        // Use explicit values to test a concrete example.
        const trader = traders()[0];
        const collateral = collateralsWithoutSusd()[0];
        const market = markets()[0];
        const marginUsdDepositAmount = bn(1000);
        const leverage = 1;
        const keeperFeeBufferUsd = 0;
        const collateralDepositAmount = bn(10);
        const collateralPrice = bn(100);
        const marketOraclePrice = bn(1);
        const makerFee = bn(0.01);
        const takerFee = bn(0.02);

        // Update state to reflect explicit values.
        await collateral.setPrice(collateralPrice);
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
        const order2 = await genOrder(
          bs,
          market,
          collateral,
          collateralDepositAmount.mul(BigNumber.from(2)),
          {
            desiredLeverage: leverage,
            desiredSide: -1, // 1 = long, -1 = short
            desiredKeeperFeeBufferUsd: keeperFeeBufferUsd,
          }
        );
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

      it('should revert when marketId does not exist', async () => {
        const { PerpMarketProxy } = systems();

        const invalidMarketId = 42069;
        await assertRevert(
          PerpMarketProxy.getOrderFees(invalidMarketId, bn(0), bn(0)),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });
    });

    // Due to a bug with hardhat_setNextBlockBaseFeePerGas, block.basefee is 0 on views. This means, it's very
    // difficult to test that keeperFees are correctly working. Will revisit this to test a different way, eg
    // to parse out the event logs that contain the keeperFee.
    //
    // @see: https://github.com/NomicFoundation/hardhat/issues/3028
    describe.skip('keeperFee', () => {
      const getKeeperFee = (
        PerpMarketProxy: PerpMarketProxy,
        receipt: ethers.ContractReceipt
      ): BigNumber => findEventSafe(receipt, 'OrderSettled', PerpMarketProxy)?.args.keeperFee;

      it('should calculate keeper fees proportional to block.baseFee and profit margin', async () => {
        const { PerpMarketProxy } = systems();

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { orderFee } = await PerpMarketProxy.getOrderFees(
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );
        const { tx, receipt, settlementTime, lastBaseFeePerGas } = await commitAndSettle(
          bs,
          marketId,
          trader,
          order
        );

        const keeperFee = getKeeperFee(PerpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);
        assertBn.equal(expectedKeeperFee, keeperFee);

        await assertEvent(
          tx,
          `OrderSettled(${trader.accountId}, ${marketId}, ${order.sizeDelta}, ${orderFee}, ${expectedKeeperFee}, ${settlementTime})`,
          PerpMarketProxy
        );
      });

      it('should cap the keeperFee by its max usd when exceeds ceiling', async () => {
        const { PerpMarketProxy } = systems();

        // Set a really high ETH price of 4.9k USD (Dec 21' ATH).
        await ethOracleNode().agg.mockSetCurrentPrice(bn(4900));

        // Cap the max keeperFee to $50 USD
        const maxKeeperFeeUsd = bn(50);
        await setMarketConfiguration(bs, { maxKeeperFeeUsd, minKeeperFeeUsd: bn(10) });

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredKeeperFeeBufferUsd: 0,
        });
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );

        const { receipt, lastBaseFeePerGas } = await commitAndSettle(bs, marketId, trader, order);

        const keeperFee = getKeeperFee(PerpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);

        assertBn.equal(keeperFee, expectedKeeperFee);
        assertBn.equal(expectedKeeperFee, maxKeeperFeeUsd);
      });

      it('should cap the keeperFee by its min usd when below floor', async () => {
        const { PerpMarketProxy } = systems();

        // Lower the min requirements to reduce fees fairly significantly.
        const minKeeperFeeUsd = bn(60);
        await setMarketConfiguration(bs, {
          keeperSettlementGasUnits: 100_000,
          maxKeeperFeeUsd: bn(100),
          minKeeperFeeUsd,
          keeperProfitMarginPercent: bn(0),
        });
        await ethOracleNode().agg.mockSetCurrentPrice(bn(100)); // $100 ETH

        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredKeeperFeeBufferUsd: 0,
        });
        const { calcKeeperOrderSettlementFee } = await calcOrderFees(
          bs,
          marketId,
          order.sizeDelta,
          order.keeperFeeBufferUsd
        );

        const { receipt, lastBaseFeePerGas } = await commitAndSettle(bs, marketId, trader, order);

        const keeperFee = getKeeperFee(PerpMarketProxy, receipt);
        const expectedKeeperFee = calcKeeperOrderSettlementFee(lastBaseFeePerGas);

        assertBn.equal(keeperFee, expectedKeeperFee);
        assertBn.equal(keeperFee, minKeeperFeeUsd);
      });
    });
  });

  describe('getFillPrice', () => {
    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const invalidMarketId = bn(42069);

      // Size to check fill price
      const size = bn(genNumber(-10, 10));

      await assertRevert(
        PerpMarketProxy.getFillPrice(invalidMarketId, size),
        `MarketNotFound("${invalidMarketId}")`
      );
    });

    it('should give premium when increasing skew', async () => {
      const { PerpMarketProxy } = systems();

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
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);

      // Using size to simulate short which will reduce the skew.
      const size = bn(genNumber(1, 10));

      const actualFillPrice = await PerpMarketProxy.getFillPrice(marketId, size);

      // To get a "premium" to our long we expect the price to have a premium
      assertBn.gt(actualFillPrice, oraclePrice);
    });

    it('should give discount when reducing skew', async () => {
      const { PerpMarketProxy } = systems();

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
      const fillPrice = await PerpMarketProxy.getFillPrice(marketId, order.sizeDelta.mul(-1));
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);

      // To get a discount, we expect longs (invert short) to receive a lower price and shorts
      // (invert long) to receive a higher price.
      if (orderSide === 1) {
        assertBn.gt(fillPrice, oraclePrice);
      } else {
        assertBn.lt(fillPrice, oraclePrice);
      }
    });

    it('should return mark price as fillPrice when size is 0', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data.
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { skewScale } = await PerpMarketProxy.getMarketConfigurationById(marketId);
      const marketSkew = order.sizeDelta;

      // Size to check fill price.
      const size = bn(0);

      const actualFillPrice = await PerpMarketProxy.getFillPrice(marketId, size);
      const expectedFillPrice = wei(1).add(wei(marketSkew).div(skewScale)).mul(oraclePrice).toBN();

      // Using near to avoid rounding errors.
      assertBn.near(expectedFillPrice, actualFillPrice);
    });

    it('should calculate fillPrice (exhaustive)', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Collect some data.
      const oraclePrice = await PerpMarketProxy.getOraclePrice(marketId);
      const { skewScale } = await PerpMarketProxy.getMarketConfigurationById(marketId);
      const marketSkew = order.sizeDelta;

      // Size to check fill price.
      const size = bn(genNumber(-10, 10));

      const actualFillPrice = await PerpMarketProxy.getFillPrice(marketId, size);
      const expectedFillPrice = calcFillPrice(marketSkew, skewScale, size, oraclePrice);

      assertBn.equal(expectedFillPrice, actualFillPrice);
    });
  });

  describe('getOraclePrice', () => {
    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const invalidMarketId = 42069;
      await assertRevert(
        PerpMarketProxy.getOraclePrice(invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });
});
