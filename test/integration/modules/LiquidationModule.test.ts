import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { BigNumber } from 'ethers';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNonUsdCollateral,
  genNumber,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
} from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  commitOrder,
  setMarketConfigurationById,
  getBlockTimestamp,
  withExplicitEvmMine,
  findEventSafe,
  SYNTHETIX_USD_MARKET_ID,
} from '../../helpers';
import forEach from 'mocha-each';
import { times } from 'lodash';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, keeper, keeper2, keeper3, endorsedKeeper, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('flagPosition', () => {
    it('should flag a position with a health factor <= 1', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, wei(1).toBN());

      const tx = await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      const keeperAddress = await keeper().getAddress();
      await assertEvent(
        tx,
        `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${keeperAddress}", ${newMarketOraclePrice})`,
        PerpMarketProxy
      );
    });

    it('should remove any pending orders when present', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Commit a new order but don't settle.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 0.5,
        desiredSide: orderSide,
      });
      await commitOrder(bs, marketId, trader, order2);
      const commitmentTime = await getBlockTimestamp(provider());

      // Price moves 10% and results in a healthFactor of < 1.
      const newMarketOraclePrice = wei(order2.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const tx = await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      const keeperAddress = await keeper().getAddress();
      await assertEvent(
        tx,
        `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${keeperAddress}", ${newMarketOraclePrice})`,
        PerpMarketProxy
      );
      await assertEvent(tx, `OrderCanceled(${trader.accountId}, ${marketId}, ${commitmentTime})`, PerpMarketProxy);
    });

    it('should sell all available synth collateral for sUSD when flagging', async () => {
      const { PerpMarketProxy } = systems();

      const collateral = genNonUsdCollateral(bs);
      const orderSide = genSide();
      const marginUsd = genOneOf([1000, 5000]);

      const { trader, market, marketId, collateralDepositAmount, marginUsdDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral, desiredMarginUsdDepositAmount: marginUsd })
      );

      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Verify no USD but _some_ non-USD collateral was used as margin.
      const d1 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      const collateralBalanceBefore = d1.collateral
        .filter((c) => c.synthMarketId.eq(collateral.synthMarket.marketId()))
        .map((c) => c.available)[0];
      const usdBalanceBefore = d1.collateral
        .filter((c) => c.synthMarketId.eq(SYNTHETIX_USD_MARKET_ID))
        .map((c) => c.available)[0];

      assertBn.equal(collateralBalanceBefore, collateralDepositAmount);
      assertBn.isZero(usdBalanceBefore);

      // Price moves 10% and results in a healthFactor of < 1.
      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      // Flag for liqudation, triggering the sale of collateral for sUSD.
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Assert the collateral has been sold and all that's left is sUSD (minus fees).
      const d2 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const collateralBalanceAfter = d2.collateral
        .filter((c) => c.synthMarketId.eq(collateral.synthMarket.marketId()))
        .map((c) => c.available)[0];
      const usdBalanceAfter = d2.collateral
        .filter((c) => c.synthMarketId.eq(SYNTHETIX_USD_MARKET_ID))
        .map((c) => c.available)[0];

      assertBn.isZero(collateralBalanceAfter);
      assertBn.near(usdBalanceAfter, marginUsdDepositAmount); // .near to account for spot-market skewFee.
    });

    it('should not sell any synth collateral when all collateral is already sUSD');

    it('should emit all events in correct order');

    it('should revert when position already flagged', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
        desiredSide: orderSide,
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

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(invalidAccountId, marketId),
        `PositionNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('liquidatePosition', () => {
    it('should fully liquidate a flagged position', async () => {
      const { PerpMarketProxy } = systems();

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

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { tx, receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const keeperAddress = await keeper().getAddress();

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const positionLiquidatedEventProperties = [
        trader.accountId,
        marketId,
        0, // sizeRemaining (expected full liquidation).
        `"${keeperAddress}"`, // keeper
        `"${keeperAddress}"`, // flagger
        positionLiquidatedEvent?.args.liqReward,
        positionLiquidatedEvent?.args.keeperFee,
        newMarketOraclePrice,
      ].join(', ');

      await assertEvent(tx, `PositionLiquidated(${positionLiquidatedEventProperties})`, PerpMarketProxy);
    });

    it('should liquidate a flagged position even if health > 1', async () => {
      const { PerpMarketProxy } = systems();

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

      const { healthFactor: hf1 } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lt(hf1, wei(1).toBN());
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Price moves back and they're no longer in liquidation but already flagged.
      await market.aggregator().mockSetCurrentPrice(wei(marketOraclePrice).toBN());
      const { healthFactor: hf2 } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.gt(hf2, wei(1).toBN());

      // Attempt the liquidate. This should complete successfully.
      const { tx, receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        provider()
      );
      const keeperAddress = await keeper().getAddress();

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const positionLiquidatedEventProperties = [
        trader.accountId,
        marketId,
        0, // sizeRemaining (expected full liquidation).
        `"${keeperAddress}"`, // keeper
        `"${keeperAddress}"`, // flagger
        positionLiquidatedEvent?.args.liqReward,
        positionLiquidatedEvent?.args.keeperFee,
        marketOraclePrice,
      ].join(', ');

      await assertEvent(tx, `PositionLiquidated(${positionLiquidatedEventProperties})`, PerpMarketProxy);
    });

    it('should update market size and skew upon full liquidation', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      const d1 = await PerpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const d2 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.lt(d2.size, d1.size);
      assertBn.lt(d2.skew.abs(), d1.skew.abs());
      assertBn.isZero(d2.size);
      assertBn.isZero(d2.skew);
    });

    it('should update lastLiq{time,utilization}', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      const d1 = await PerpMarketProxy.getMarketDigest(marketId);

      // Attempt the liquidate. This should complete successfully.
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const d2 = await PerpMarketProxy.getMarketDigest(marketId);

      assertBn.gt(d2.lastLiquidationTime, d1.lastLiquidationTime);
      assertBn.lt(d2.remainingLiquidatableSizeCapacity, d1.remainingLiquidatableSizeCapacity);
    });

    it('should send liqReward to flagger and keeperFee to liquidator', async () => {
      const { PerpMarketProxy, USD } = systems();

      const settlementKeeper = keeper();
      const flaggerKeeper = keeper2();
      const liquidatorKeeper = keeper3();

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
      await commitAndSettle(bs, marketId, trader, order, { desiredKeeper: settlementKeeper });

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(liquidatorKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const liqReward = positionLiquidatedEvent?.args.liqReward as BigNumber;
      const keeperFee = positionLiquidatedEvent?.args.keeperFee as BigNumber;

      assertBn.equal(await USD.balanceOf(await flaggerKeeper.getAddress()), liqReward);
      assertBn.equal(await USD.balanceOf(await liquidatorKeeper.getAddress()), keeperFee);
    });

    it('should send send both fees to flagger if same keeper', async () => {
      const { PerpMarketProxy, USD } = systems();

      const settlementKeeper = keeper();
      const flaggerKeeper = keeper2();

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
      await commitAndSettle(bs, marketId, trader, order, { desiredKeeper: settlementKeeper });

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(flaggerKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const liqReward = positionLiquidatedEvent?.args.liqReward as BigNumber;
      const keeperFee = positionLiquidatedEvent?.args.keeperFee as BigNumber;
      const expectedKeeperUsdBalance = liqReward.add(keeperFee);

      assertBn.equal(await USD.balanceOf(await flaggerKeeper.getAddress()), expectedKeeperUsdBalance);
    });

    it('should not send endorsed keeper any liquidation rewards when flagger', async () => {
      const { PerpMarketProxy, USD } = systems();

      const settlementKeeper = keeper();
      const flaggerKeeper = endorsedKeeper();
      const liquidatorKeeper = keeper2();

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
      await commitAndSettle(bs, marketId, trader, order, { desiredKeeper: settlementKeeper });

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(liquidatorKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const keeperFee = positionLiquidatedEvent?.args.keeperFee as BigNumber;

      // Expect the flagger to receive _nothing_ and liquidator to receive just the keeperFee.
      assertBn.isZero(await USD.balanceOf(await flaggerKeeper.getAddress()));
      assertBn.equal(await USD.balanceOf(await liquidatorKeeper.getAddress()), keeperFee);
    });

    it('should not send endorsed keeper liqReward when they are both flagger and liquidator', async () => {
      const { PerpMarketProxy, USD } = systems();

      const settlementKeeper = keeper();
      const flaggerKeeper = endorsedKeeper();

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
      await commitAndSettle(bs, marketId, trader, order, { desiredKeeper: settlementKeeper });

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

      // Attempt the liquidate. This should complete successfully.
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(flaggerKeeper).liquidatePosition(trader.accountId, marketId),
        provider()
      );

      const positionLiquidatedEvent = findEventSafe({
        receipt,
        eventName: 'PositionLiquidated',
        contract: PerpMarketProxy,
      });
      const keeperFee = positionLiquidatedEvent?.args.keeperFee as BigNumber;

      // Only receive keeperFee, no liqReward should be sent.
      assertBn.equal(await USD.balanceOf(await flaggerKeeper.getAddress()), keeperFee);
    });

    it('should remove flagger on full liquidation', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation, liquidate.
      const orderSide = genSide();
      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const marketId = market.marketId();
      const collateral = genOneOf(collaterals());

      // Set a large enough liqCap to ensure a full liquidation.
      await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: wei(100).toBN() });

      const gTrader1 = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: trader, desiredMarket: market, desiredCollateral: collateral })
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
      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const gTrader2 = await depositMargin(
        bs,
        genTrader(bs, { desiredTrader: trader, desiredMarket: market, desiredCollateral: collateral })
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
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFlagged()`,
        PerpMarketProxy
      );
    });

    it('should remove all position collateral from market on liquidation', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. For the purposes
      // of this test, ensure we can liquidate the entire position in one call (hence the smaller
      // marginUsd deposit amounts).
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

      const d1 = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);

      const d2 = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      const { collateralUsd } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      assertBn.gt(d1.remainingMarginUsd, d2.remainingMarginUsd);
      assertBn.isZero(d2.remainingMarginUsd);
      assertBn.isZero(collateralUsd);
    });

    it('should emit all events in correct order');

    it('should recompute funding', async () => {
      const { PerpMarketProxy } = systems();

      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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

      await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
      const tx = await PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
      await assertEvent(tx, `FundingRecomputed`, PerpMarketProxy);
    });

    it('should revert when position is not flagged', async () => {
      const { PerpMarketProxy } = systems();

      // Commit, settle, place position into liquidation.
      const orderSide = genSide();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
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

      // Attempt the liquidate. Not flagged, should not liquidate.
      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFlagged()`,
        PerpMarketProxy
      );
    });

    it('should revert when no open position or already liquidated', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await genTrader(bs);
      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
        `PositionNotFound()`,
        PerpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    describe('getRemainingLiquidatableSizeCapacity', () => {
      const calcMaxLiquidatableCapacity = (
        makerFee: BigNumber,
        takerFee: BigNumber,
        skewScale: BigNumber,
        liquidationLimitScalar: BigNumber
      ) => wei(makerFee.add(takerFee)).mul(skewScale).mul(liquidationLimitScalar).toBN();

      describe('maxLiquidatableCapacity', () => {
        it('should be calculated relative to makerFee/takerFee and skewScale', async () => {
          const { PerpMarketProxy } = systems();
          const market = genOneOf(markets());
          const marketId = market.marketId();

          const liquidationLimitScalar = bn(1);
          const makerFee = bn(0.0001);
          const takerFee = bn(0.0001);
          const skewScale = bn(1_000_000);

          await setMarketConfigurationById(bs, marketId, {
            liquidationLimitScalar,
            makerFee,
            takerFee,
            skewScale,
          });

          const { maxLiquidatableCapacity } = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
          const expectedMaxLiquidatableCapacity = calcMaxLiquidatableCapacity(
            makerFee,
            takerFee,
            skewScale,
            liquidationLimitScalar
          );
          assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);
        });

        /* Randomly test 10 scalars between 0 and 1 (inclusive, always include boundaries). */
        forEach([0, ...times(8).map(() => genNumber(0.1, 0.9)), 1]).it(
          `should scale with liquidationLimitScalar of '%0.5f'`,
          async (scalar: number) => {
            const { PerpMarketProxy } = systems();
            const market = genOneOf(markets());
            const marketId = market.marketId();

            const makerFee = bn(genNumber(0.0001, 0.0005));
            const takerFee = bn(genNumber(0.0006, 0.001));
            const skewScale = bn(1_000_000);

            const liquidationLimitScalar = bn(scalar);
            await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar, makerFee, takerFee, skewScale });

            const { maxLiquidatableCapacity } = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
            const expectedMaxLiquidatableCapacity = calcMaxLiquidatableCapacity(
              makerFee,
              takerFee,
              skewScale,
              liquidationLimitScalar
            );
            assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);
          }
        );
      });
    });

    describe('{partialLiqudation,liqCaps}', () => {
      it('should partially liquidate and exhaust cap if position hits liq window cap', async () => {
        const { PerpMarketProxy } = systems();

        // Set a known price so downstream calculations ensure a partial liqudation.
        const market = genOneOf(markets());
        await market.aggregator().mockSetCurrentPrice(wei(29_000).toBN());
        const orderSide = genSide();

        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredMarket: market, desiredMarginUsdDepositAmount: 25_000 })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(0.01),
          makerFee: bn(0.0001),
          takerFee: bn(0.0001),
          skewScale: bn(500_000),
        });

        const cap1 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.lt(cap1.remainingCapacity, collateralDepositAmount);
        assertBn.gt(cap1.remainingCapacity, 0);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

        // Attempt the liquidate. This should complete successfully.
        const { tx, receipt } = await withExplicitEvmMine(
          () => PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const keeperAddress = await keeper().getAddress();
        const positionLiquidatedEvent = findEventSafe({
          receipt,
          eventName: 'PositionLiquidated',
          contract: PerpMarketProxy,
        });

        const expectedRemainingSize = order.sizeDelta.abs().sub(cap1.remainingCapacity).mul(orderSide);
        const positionLiquidatedEventProperties = [
          trader.accountId,
          marketId,
          expectedRemainingSize,
          `"${keeperAddress}"`, // keeper
          `"${keeperAddress}"`, // flagger
          positionLiquidatedEvent?.args.liqReward,
          positionLiquidatedEvent?.args.keeperFee,
          newMarketOraclePrice,
        ].join(', ');

        await assertEvent(tx, `PositionLiquidated(${positionLiquidatedEventProperties})`, PerpMarketProxy);

        const cap2 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);
      });

      it('should partially update market skew/size when partially liquidated', async () => {
        const { PerpMarketProxy } = systems();

        // Set a known price so downstream calculations ensure a partial liqudation.
        const market = genOneOf(markets());
        await market.aggregator().mockSetCurrentPrice(wei(29_000).toBN());
        const orderSide = genSide();

        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredMarket: market, desiredMarginUsdDepositAmount: 25_000 })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(0.01),
          makerFee: bn(0.0001),
          takerFee: bn(0.0001),
          skewScale: bn(250_000),
        });

        const cap1 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.lt(cap1.remainingCapacity, collateralDepositAmount);
        assertBn.gt(cap1.remainingCapacity, 0);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

        await withExplicitEvmMine(
          () => PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const expectedRemainingSize = order.sizeDelta.abs().sub(cap1.remainingCapacity).mul(orderSide);
        const d1 = await PerpMarketProxy.getMarketDigest(marketId);
        assertBn.equal(d1.size, expectedRemainingSize.abs());
        assertBn.equal(d1.skew, expectedRemainingSize);
      });

      it('should allow an endorsed keeper to fully liquidate a position even if above caps', async () => {
        const { PerpMarketProxy } = systems();

        // Set a known price so downstream calculations ensure a partial liqudation.
        const market = genOneOf(markets());
        await market.aggregator().mockSetCurrentPrice(wei(29_000).toBN());
        const orderSide = genSide();

        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredMarket: market, desiredMarginUsdDepositAmount: 25_000 })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(0.01),
          makerFee: bn(0.0001),
          takerFee: bn(0.0001),
          skewScale: bn(250_000),
        });

        const cap1 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.lt(cap1.remainingCapacity, collateralDepositAmount);
        assertBn.gt(cap1.remainingCapacity, 0);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Attempt the liquidate. This should complete successfully.
        const { tx, receipt } = await withExplicitEvmMine(async () => {
          await PerpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);
          return PerpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId);
        }, provider());

        const keeperAddress = await keeper().getAddress();
        const positionLiquidatedEvent = findEventSafe({
          receipt,
          eventName: 'PositionLiquidated',
          contract: PerpMarketProxy,
        });

        const expectedRemainingSize = order.sizeDelta.abs().sub(cap1.remainingCapacity).mul(orderSide);
        const positionLiquidatedEventProperties = [
          trader.accountId,
          marketId,
          expectedRemainingSize,
          `"${keeperAddress}"`, // keeper
          `"${keeperAddress}"`, // flagger
          positionLiquidatedEvent?.args.liqReward,
          positionLiquidatedEvent?.args.keeperFee,
          newMarketOraclePrice,
        ].join(', ');

        await assertEvent(tx, `PositionLiquidated(${positionLiquidatedEventProperties})`, PerpMarketProxy);

        const cap2 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);

        // Endorsed liqudaitor to liquidate remaining capacity.
        const d1 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.equal(d1.position.size, expectedRemainingSize);

        await withExplicitEvmMine(
          () => PerpMarketProxy.connect(endorsedKeeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const d2 = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.isZero(d2.position.size);

        const cap3 = await PerpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap3.remainingCapacity);
      });

      it('should allow liquidations even if exceed caps if pd is below maxPd');

      it('should use up cap (partial) before exceeding if pd < maxPd');

      it('should track and include endorsed keeper activity (cap + time) on liquidations');

      it('should not remove flagger on partial liquidation');

      it('should accumulate an existing liquidation if two tx in the same block');

      it('should revert when liq cap has been met and not endorsed');

      it('should revert when pd is below maxPd but liquidation happens in the same block');
    });
  });
});
