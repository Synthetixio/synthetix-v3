import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { PerpCollateral, bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genOneOf, genOrder, genSide, genTrader } from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  commitOrder,
  setMarketConfigurationById,
  getBlockTimestamp,
  withExplicitEvmMine,
  findEventSafe,
  extendContractAbi,
  ADDRESS0,
  getSusdCollateral,
  setBaseFeePerGas,
  isSusdCollateral,
} from '../../helpers';
import { assertEvents } from '../../assert';
import { calcFlagReward } from '../../calculations';
import { utils } from 'ethers';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { pool, collaterals, collateralsWithoutSusd, keeper, keeper2, systems, provider, restore } =
    bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('flagPosition', () => {
    it('should flag a position with a health factor <= 1', async () => {
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
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      // set base fee to 0 gwei to avoid rounding errors
      await setBaseFeePerGas(0, provider());
      const { flagKeeperReward } = await BfpMarketProxy.getLiquidationFees(
        trader.accountId,
        marketId
      );

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      const keeperAddress = await keeper().getAddress();
      await assertEvent(
        receipt,
        `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${keeperAddress}", ${flagKeeperReward}, ${newMarketOraclePrice})`,
        BfpMarketProxy
      );
    });

    it('should charge a flag reward that is larger than the notional value', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
          desiredMarginUsdDepositAmount: 10_000,
        })
      );
      // Create some debt
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount);

      await commitAndSettle(bs, marketId, trader, order1);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order1.oraclePrice)
        .mul(order1.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      await commitAndSettle(
        bs,
        marketId,
        trader,
        genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: order1.sizeDelta.mul(-1),
        })
      );

      // Create a small order
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(100).div(newMarketOraclePrice).toBN(),
      });

      await commitAndSettle(bs, marketId, trader, order2);

      const { collateralUsd, debtUsd } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      // 0 debtUsd and collateral bigger than debtUsd
      assertBn.gt(debtUsd, 0);
      assertBn.gt(collateralUsd, debtUsd);

      // Calculate the decrease percentage required to get a collateral value just below the debt
      const decreasePercentage = wei(collateralUsd)
        .sub(debtUsd)
        .div(collateralUsd)
        .add(0.01)
        .toNumber();
      const collateralPrice = await collateral.getPrice();

      // Decrease collateral price and assert that collateral is smaller than debt and that position is liquidatable.
      await collateral.setPrice(wei(collateralPrice).mul(wei(1).sub(decreasePercentage)).toBN());
      const { collateralUsd: newCollateralUsd, position } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.lt(position.healthFactor, 1);

      assertBn.lt(newCollateralUsd, debtUsd);
      // Make sure collateral is bigger than size so the flag reward is based on collateral
      assertBn.gt(newCollateralUsd, wei(position.size).mul(newMarketOraclePrice).toBN());

      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      const flagEvent = findEventSafe(receipt, 'PositionFlaggedLiquidation', BfpMarketProxy);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

      const expectedFlagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        wei(order2.sizeDelta.abs()),
        wei(newMarketOraclePrice),
        wei(newCollateralUsd),
        await BfpMarketProxy.getMarketConfiguration(),
        await BfpMarketProxy.getMarketConfigurationById(marketId)
      );

      assertBn.equal(flagEvent.args.flagKeeperReward, expectedFlagReward.toBN());
    });

    it('should charge the larger flagKeeperReward when notional value > collateral value', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 10,
      });

      await commitAndSettle(bs, marketId, trader, order);

      // Price falls/rises between 10% should results in a healthFactor of < 1.
      //
      // Whether it goes up or down depends on the side of the order.
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(order.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      // Grab collateral value before flagging so we can use it to calculate the expected flag reward.
      const { collateralUsd } = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      const flagEvent = findEventSafe(receipt, 'PositionFlaggedLiquidation', BfpMarketProxy);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

      const expectedFlagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        wei(order.sizeDelta.abs()),
        wei(newMarketOraclePrice),
        wei(collateralUsd),
        await BfpMarketProxy.getMarketConfiguration(),
        await BfpMarketProxy.getMarketConfigurationById(marketId)
      );

      assertBn.equal(flagEvent.args.flagKeeperReward, expectedFlagReward.toBN());
    });

    it('should be able to flag when market is in close only', async () => {
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
      const newMarketOraclePrice = wei(order.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      assertBn.lte(healthFactor, bn(1));

      await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
      const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(marketId);

      assertBn.equal(maxMarketSize, 0);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );
      await assertEvent(receipt, 'PositionFlaggedLiquidation', BfpMarketProxy);
    });

    it('should remove any pending orders when present', async () => {
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

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        provider()
      );

      // Just assert that flag is triggered, actual values are tested elsewhere
      await assertEvent(receipt, 'PositionFlaggedLiquidation', BfpMarketProxy);
      await assertEvent(
        receipt,
        `OrderCanceled(${trader.accountId}, ${marketId}, 0, ${commitmentTime})`,
        BfpMarketProxy
      );
    });

    it('should send flagKeeperReward to keeper', async () => {
      const { BfpMarketProxy, USD } = systems();

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

      // Commit a new order but don't settle.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 0.5,
        desiredSide: orderSide,
      });
      await commitOrder(bs, marketId, trader, order2);

      // Price moves 10% and results in a healthFactor of < 1.
      const newMarketOraclePrice = wei(order2.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      const flagKeeper = keeper2();

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(flagKeeper).flagPosition(trader.accountId, marketId),
        provider()
      );
      const flagEvent = findEventSafe(receipt, 'PositionFlaggedLiquidation', BfpMarketProxy);

      assertBn.equal(
        await USD.balanceOf(await flagKeeper.getAddress()),
        flagEvent.args.flagKeeperReward
      );
    });

    it('should reset account debt and update total trader debt', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount, collateralPrice } =
        await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) }) // use non-sUSD collateral to make sure we accrue some debt (and don't pay it off with sUSD collateral)
        );

      // Execute two orders to accrue some debt for the trader.
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
      });
      await commitAndSettle(bs, marketId, trader, openOrder);
      const newMarketOraclePrice = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      const { receipt } = await commitAndSettle(bs, marketId, trader, closeOrder);
      const closeEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);
      const debtInCollateralAmount = wei(closeEvent.args.accountDebt).div(collateralPrice).toBN();
      // Execute a new order that will create a position that can be flagged for liquidation.
      const openFlagOrder = await genOrder(
        bs,
        market,
        collateral,
        collateralDepositAmount.sub(debtInCollateralAmount),
        {
          desiredLeverage: 9,
        }
      );
      await commitAndSettle(bs, marketId, trader, openFlagOrder);

      // Price moves 10% and results in a healthFactor of < 1.
      const newMarketOraclePrice1 = wei(openFlagOrder.oraclePrice)
        .mul(openFlagOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

      const { debtUsd: accountDebtBefore } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      const { totalTraderDebtUsd: totalTraderDebtUsdBefore } =
        await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.gt(accountDebtBefore, 0);
      assertBn.gt(totalTraderDebtUsdBefore, 0);

      await withExplicitEvmMine(
        () => BfpMarketProxy.connect(keeper2()).flagPosition(trader.accountId, marketId),
        provider()
      );

      const { debtUsd: accountDebtAfter } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      const { totalTraderDebtUsd: totalTraderDebtUsdAfter } =
        await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.isZero(accountDebtAfter);
      assertBn.isZero(totalTraderDebtUsdAfter);
    });

    it('should remove all margin collateral on flag', async () => {
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

      const d1 = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
      assertBn.gt(d1.marginUsd, 0);
      assertBn.gt(d1.collateralUsd, 0);

      // Commit a new order but don't settle.
      const order2 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 0.5,
        desiredSide: orderSide,
      });
      await commitOrder(bs, marketId, trader, order2);

      // Price moves 10% and results in a healthFactor of < 1.
      const newMarketOraclePrice = wei(order2.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      const flagKeeper = keeper2();

      await BfpMarketProxy.connect(flagKeeper).flagPosition(trader.accountId, marketId);

      // Verify all collateral deposited must be rmrf to market.
      const d2 = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
      assertBn.isZero(d2.marginUsd);
      assertBn.isZero(d2.collateralUsd);
    });

    forEach([
      ['sUSD', () => getSusdCollateral(collaterals())],
      ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
    ]).it(
      'should emit all events in correct order (%s)',
      async (_, getCollateral: () => PerpCollateral) => {
        const { BfpMarketProxy, Core } = systems();

        const orderSide = genSide();
        const { trader, market, marketId, collateralDepositAmount, collateral } =
          await depositMargin(bs, genTrader(bs, { desiredCollateral: getCollateral() }));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Price falls/rises between 10% should results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        const { healthFactor } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
        assertBn.lte(healthFactor, bn(1));

        // Set base fee to 0 gwei to avoid rounding errors
        await setBaseFeePerGas(0, provider());

        const { flagKeeperReward } = await BfpMarketProxy.getLiquidationFees(
          trader.accountId,
          marketId
        );
        const { receipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );

        const blockTime = (await provider().getBlock(receipt.blockNumber)).timestamp;
        const keeperAddress = await keeper().getAddress();
        const distributorAddress = collateral.rewardDistributorAddress();
        const collateralAddress = collateral.address();
        const poolCollateralAddress = pool().collateral().address;
        const poolId = pool().id;

        let expectedEvents: Array<string | RegExp>;
        if (isSusdCollateral(collateral)) {
          expectedEvents = [
            `Transfer("${ADDRESS0}", "${keeperAddress}", ${flagKeeperReward})`,
            new RegExp(
              `MarketUsdWithdrawn\\(${marketId}, "${keeperAddress}", ${flagKeeperReward}, "${BfpMarketProxy.address}",`
            ), // + tail properties omitted.
            `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${keeperAddress}", ${flagKeeperReward}, ${newMarketOraclePrice})`,
          ];
        } else {
          expectedEvents = [
            // Withdraw and transfer from Core -> PerpMarket.
            `Transfer("${Core.address}", "${BfpMarketProxy.address}", ${collateralDepositAmount})`,
            new RegExp(
              `MarketCollateralWithdrawn\\(${marketId}, "${collateralAddress}", ${collateralDepositAmount}, "${BfpMarketProxy.address}",`
            ), // + tail properties omitted.
            // Transfer from PerpMarket -> RewardDistributor.
            `Transfer("${BfpMarketProxy.address}", "${distributorAddress}", ${collateralDepositAmount})`,
            `RewardsDistributed(${poolId}, "${poolCollateralAddress}", "${distributorAddress}", ${collateralDepositAmount}, ${blockTime}, 0)`,
            // Transfer flag reward from PerpMarket -> Keeper.
            `Transfer("${ADDRESS0}", "${keeperAddress}", ${flagKeeperReward})`,
            new RegExp(
              `MarketUsdWithdrawn\\(${marketId}, "${keeperAddress}", ${flagKeeperReward}, "${BfpMarketProxy.address}",`
            ), // + tail properties omitted.
            `PositionFlaggedLiquidation(${trader.accountId}, ${marketId}, "${keeperAddress}", ${flagKeeperReward}, ${newMarketOraclePrice})`,
          ];
        }

        const coreEvents = Core.interface.format(utils.FormatTypes.full) as string[];
        const contractsWithAllEvents = extendContractAbi(
          BfpMarketProxy,
          coreEvents.concat([
            'event Transfer(address indexed from, address indexed to, uint256 value)',
          ])
        );
        await assertEvents(receipt, expectedEvents, contractsWithAllEvents);
      }
    );

    it('should revert when position already flagged', async () => {
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

      await market.aggregator().mockSetCurrentPrice(
        wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN()
      );

      // First flag should be successful.
      await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

      // Second flag should fail because already flagged.
      await assertRevert(
        BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `PositionFlagged()`,
        BfpMarketProxy
      );
    });

    it('should revert when position health factor > 1', async () => {
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

      // Position just opened and cannot be liquidated.
      await assertRevert(
        BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `CannotLiquidatePosition()`,
        BfpMarketProxy
      );
    });

    it('should revert when no open position', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, marketId } = await depositMargin(bs, genTrader(bs));

      // Position just opened and cannot be liquidated.
      await assertRevert(
        BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
        `PositionNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        BfpMarketProxy.connect(keeper()).flagPosition(invalidAccountId, marketId),
        `PositionNotFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    describe('distributeRewards', () => {
      it('should not distribute any rewards when only sUSD collateral');

      it('should only distribute non-sUSD collateral when both available');

      it('should deduct market deposited collateral by distributed amount');

      it('should distribute proportionally across pool collaterals on flag');
    });
  });
});
