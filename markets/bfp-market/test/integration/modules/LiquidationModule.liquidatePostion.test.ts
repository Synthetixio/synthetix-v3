import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { ethers, utils } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genOneOf, genOrder, genSide, genTrader } from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  setMarketConfigurationById,
  withExplicitEvmMine,
  findEventSafe,
  extendContractAbi,
  getSusdCollateral,
  setBaseFeePerGas,
} from '../../helpers';
import { assertEvents } from '../../assert';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, keeper, keeper2, keeper3, systems, provider, restore } =
    bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('liquidatePosition', () => {
    const commitAndSettleLiquidatedPosition = async (desiredKeeper: ethers.Signer) => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, we set
      // `desiredMarginUsdDepositAmount` to a low~ish value to prevent partial liquidations.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await BfpMarketProxy.connect(desiredKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { tx, receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(desiredKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      return { tx, receipt, trader, marketId, order, newMarketOraclePrice };
    };

    it('should fully liquidate a flagged position', async () => {
      const { BfpMarketProxy } = systems();

      const desiredKeeper = keeper();
      const keeperAddress = await desiredKeeper.getAddress();

      const { tx, receipt, trader, order, marketId, newMarketOraclePrice } =
        await commitAndSettleLiquidatedPosition(desiredKeeper);

      const positionLiquidatedEvent = findEventSafe(receipt, 'PositionLiquidated', BfpMarketProxy);
      const positionLiquidatedEventProperties = [
        trader.accountId,
        marketId,
        order.sizeDelta,
        0, // sizeRemaining (expected full liquidation).
        `"${keeperAddress}"`, // keeper
        `"${keeperAddress}"`, // flagger
        positionLiquidatedEvent?.args.liqKeeperFee,
        newMarketOraclePrice,
      ].join(', ');

      await assertEvent(
        tx,
        `PositionLiquidated(${positionLiquidatedEventProperties})`,
        BfpMarketProxy
      );
    });

    it('should liquidate a flagged position even if health > 1', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, set
      // `desiredMarginUsdDepositAmount` to a low~ish value to prevent partial liquidations.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([1000, 3000, 5000]) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const marketOraclePrice = order.oraclePrice;
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      const { healthFactor: hf1 } = await BfpMarketProxy.getPositionDigest(
        trader.accountId,
        marketId
      );
      assertBn.lt(hf1, bn(1));
      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Price moves back and they're no longer in liquidation but already flagged.
      await market.aggregator().mockSetCurrentPrice(marketOraclePrice);
      const { healthFactor: hf2 } = await BfpMarketProxy.getPositionDigest(
        trader.accountId,
        marketId
      );
      assertBn.isZero(hf2);

      // Attempt the liquidate. This should complete successfully.
      const { tx, receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );
      const keeperAddress = await keeper().getAddress();

      const positionLiquidatedEvent = findEventSafe(receipt, 'PositionLiquidated', BfpMarketProxy);
      const positionLiquidatedEventProperties = [
        trader.accountId,
        marketId,
        order.sizeDelta,
        0, // sizeRemaining (expected full liquidation).
        `"${keeperAddress}"`, // keeper
        `"${keeperAddress}"`, // flagger
        positionLiquidatedEvent?.args.liqKeeperFee,
        marketOraclePrice,
      ].join(', ');

      await assertEvent(
        tx,
        `PositionLiquidated(${positionLiquidatedEventProperties})`,
        BfpMarketProxy
      );
    });

    it('should be able to liquidate even when market is in close only', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, we set
      // `desiredMarginUsdDepositAmount` to a low~ish value to prevent partial liquidations.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();

      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );

      // Set market to close only
      await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
      const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(marketId);
      assertBn.equal(maxMarketSize, 0);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );
      await assertEvent(receipt, 'PositionLiquidated', BfpMarketProxy);
    });

    it('should update market size and skew upon full liquidation', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Set a large enough cap to ensure we always get full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      await market.aggregator().mockSetCurrentPrice(
        wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );

      const d1 = await BfpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const d2 = await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.lt(d2.size, d1.size);
      assertBn.lt(d2.skew.abs(), d1.skew.abs());
      assertBn.isZero(d2.size);
      assertBn.isZero(d2.skew);
    });

    it('full liquidation should update reported debt/total debt', async () => {
      const { BfpMarketProxy, Core } = systems();
      const orderSide = genSide();

      const { trader, collateral, collateralDepositAmount, market, marketId } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: getSusdCollateral(collaterals()),
          desiredMarginUsdDepositAmount: 10000, // small enough to not be partial liq
        })
      );
      await setMarketConfigurationById(bs, marketId, {
        maxFundingVelocity: bn(0), // disable funding to avoid minor funding losses
      });

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
        desiredSide: orderSide,
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.5 : 2)
        .toBN();

      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const totalDebtAfterPriceChange = await Core.getMarketTotalDebt(marketId);

      const { receipt: flagReceipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );

      const { receipt: liqReceipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const totalDebtAfterLiq = await Core.getMarketTotalDebt(marketId);

      const positionFlagEvent = findEventSafe(
        flagReceipt,
        'PositionFlaggedLiquidation',
        BfpMarketProxy
      );
      const positionLiquidatedEvent = findEventSafe(
        liqReceipt,
        'PositionLiquidated',
        BfpMarketProxy
      );

      const totalDebtAfterFees = wei(totalDebtAfterPriceChange)
        .add(positionLiquidatedEvent.args.liqKeeperFee)
        .add(positionFlagEvent.args.flagKeeperReward);
      // On a full liquidation
      assertBn.equal(totalDebtAfterFees.toBN(), totalDebtAfterLiq);
    });

    it('should update lastLiq{time,utilization}', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);

      await market.aggregator().mockSetCurrentPrice(
        wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );

      const d1 = await BfpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const d2 = await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.gt(d2.lastLiquidationTime, d1.lastLiquidationTime);
      assertBn.lt(d2.remainingLiquidatableSizeCapacity, d1.remainingLiquidatableSizeCapacity);
    });

    it('should send liqKeeperFee to liquidator', async () => {
      const { BfpMarketProxy, USD } = systems();

      const settlementKeeper = keeper();
      const flaggerKeeper = keeper2();
      const liquidatorKeeper = keeper3();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, set
      // `desiredMarginUsdDepositAmount` to a low~ish value to prevent partial liquidations.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([2000, 3000, 5000]) })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order, { desiredKeeper: settlementKeeper });

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(liquidatorKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const positionLiquidatedEvent = findEventSafe(receipt, 'PositionLiquidated', BfpMarketProxy);

      assertBn.equal(
        await USD.balanceOf(await liquidatorKeeper.getAddress()),
        positionLiquidatedEvent.args.liqKeeperFee
      );
    });

    it('should remove flagger on full liquidation', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation, liquidate.
      const orderSide = genSide();
      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const marketId = market.marketId();
      const collateral = genOneOf(collaterals());

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(100) });

      const gTrader1 = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: trader,
          desiredMarket: market,
          desiredCollateral: collateral,
        })
      );
      const order1 = await genOrder(bs, market, collateral, gTrader1.collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      const { answer: marketOraclePrice1 } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice1)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );
      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      await BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const gTrader2 = await depositMargin(
        bs,
        genTrader(bs, {
          desiredTrader: trader,
          desiredMarket: market,
          desiredCollateral: collateral,
        })
      );
      const order2 = await genOrder(bs, market, collateral, gTrader2.collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order2);

      const { answer: marketOraclePrice2 } = await market.aggregator().latestRoundData();
      await market.aggregator().mockSetCurrentPrice(
        wei(marketOraclePrice2)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      // Liquidation should fail because the flagger was previously removed for this trader.
      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFlagged()`,
        BfpMarketProxy
      );
    });

    it('should remove all market deposited collateral after full liquidation', async () => {
      const { BfpMarketProxy } = systems();

      const { marketId } = await commitAndSettleLiquidatedPosition(keeper());

      // Expecting ZERO collateral deposited into the market.
      const d1 = await BfpMarketProxy.getMarketDigest(marketId);
      d1.depositedCollaterals.map((c) => assertBn.isZero(c.available));
    });

    it('should remove all account margin collateral after full liquidation', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await commitAndSettleLiquidatedPosition(keeper());

      // Expecting ZERO collateral left associated with the account.
      const d = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(d.collateralUsd);
      d.depositedCollaterals.forEach((c) => assertBn.isZero(c.available));
    });

    it('should update utilization rate after market update during liqudation', async () => {
      const { BfpMarketProxy, Core } = systems();
      const { receipt } = await commitAndSettleLiquidatedPosition(keeper());
      const coreEvents = Core.interface.format(utils.FormatTypes.full) as string[];
      const contractsWithAllEvents = extendContractAbi(
        BfpMarketProxy,
        coreEvents.concat([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ])
      );

      // Here we check that 'MarketSizeUpdated' is _before_ 'UtilizationRecomputed'.
      await assertEvents(
        receipt,
        [
          /FundingRecomputed/,
          /MarketSizeUpdated/,
          /UtilizationRecomputed/,
          /Transfer/,
          /MarketUsdWithdrawn/,
          /PositionLiquidated/,
        ],
        contractsWithAllEvents
      );
    });

    it('should emit all events in correct order');

    it('should recompute funding', async () => {
      const { BfpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      await market.aggregator().mockSetCurrentPrice(
        wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );
      await assertEvent(receipt, `FundingRecomputed`, BfpMarketProxy);
    });

    it('should revert when position is not flagged', async () => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order);
      // Price moves 10%
      await market.aggregator().mockSetCurrentPrice(
        wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      // Attempt the liquidate. Not flagged, should not liquidate.
      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFlagged()`,
        BfpMarketProxy
      );
    });

    it('should revert when no open position or already liquidated', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, marketId } = await genTrader(bs);
      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidatePosition(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    describe('getLiquidationFees', () => {
      it('should revert when accountId does not exist', async () => {
        const { BfpMarketProxy } = systems();

        const market = genOneOf(markets());
        const invalidAccountId = 42069;

        await assertRevert(
          BfpMarketProxy.getLiquidationFees(invalidAccountId, market.marketId()),
          `AccountNotFound("${invalidAccountId}")`,
          BfpMarketProxy
        );
      });

      it('should revert when marketId does not exist', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const invalidMarketId = 42069;

        await assertRevert(
          BfpMarketProxy.getLiquidationFees(trader.accountId, invalidMarketId),
          `MarketNotFound("${invalidMarketId}")`,
          BfpMarketProxy
        );
      });

      it('should return zero when accountId/marketId exists but no position', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());

        const { flagKeeperReward, liqKeeperFee } = await BfpMarketProxy.getLiquidationFees(
          trader.accountId,
          market.marketId()
        );
        assertBn.isZero(flagKeeperReward);
        assertBn.isZero(liqKeeperFee);
      });

      it('should return the expected liquidationFees on a large open position');

      it('should return the expected liquidationFees on a small open position');
    });
  });
});
