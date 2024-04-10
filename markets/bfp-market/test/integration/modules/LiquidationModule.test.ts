import assert from 'assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import Wei, { wei } from '@synthetixio/wei';
import { BigNumber, Signer, ethers, utils } from 'ethers';
import { shuffle, times } from 'lodash';
import forEach from 'mocha-each';
import { PerpCollateral, bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genOneOf,
  genOrder,
  genOrderFromSizeDelta,
  genSide,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  depositMargin,
  commitAndSettle,
  commitOrder,
  setMarketConfigurationById,
  getBlockTimestamp,
  withExplicitEvmMine,
  findEventSafe,
  fastForwardBySec,
  extendContractAbi,
  ADDRESS0,
  getSusdCollateral,
  sleep,
  setMarketConfiguration,
  setBaseFeePerGas,
  isSusdCollateral,
} from '../../helpers';
import { Market, Trader } from '../../typed';
import { assertEvents } from '../../assert';
import {
  calcFlagReward,
  calcLiquidationKeeperFee,
  calcTransactionCostInUsd,
} from '../../calculations';
import { PerpMarketConfiguration } from '../../generated/typechain/MarketConfigurationModule';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const {
    pool,
    markets,
    collaterals,
    collateralsWithoutSusd,
    traders,
    keeper,
    keeper2,
    keeper3,
    endorsedKeeper,
    systems,
    provider,
    restore,
  } = bs;

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
        const { BfpMarketProxy, Core, SpotMarket } = systems();

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
        const collateralAddress = collateral.synthAddress();
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

        // Create a contract that can parse all events emitted.
        //
        // This isn't necessary for sUSD collateral but it doesn't affect the correctness of this test.
        const spotMarketEvents = SpotMarket.interface.format(utils.FormatTypes.full);
        const contractsWithAllEvents = extendContractAbi(
          BfpMarketProxy,
          Core.interface
            .format(utils.FormatTypes.full)
            .concat(spotMarketEvents)
            .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
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

  describe('liquidatePosition', () => {
    const commitAndSettleLiquidatedPosition = async (desiredKeeper: ethers.Signer) => {
      const { BfpMarketProxy } = systems();

      // Commit, settle, place position into liquidation, flag for liquidation. Additionally, we set
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
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([1000, 3000, 5000]) })
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
        genTrader(bs, { desiredMarginUsdDepositAmount: genOneOf([1000, 3000, 5000]) })
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

      const contractsWithAllEvents = extendContractAbi(
        BfpMarketProxy,
        Core.interface
          .format(utils.FormatTypes.full)
          .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
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

    describe('getRemainingLiquidatableSizeCapacity', () => {
      const calcMaxLiquidatableCapacity = (
        makerFee: BigNumber,
        takerFee: BigNumber,
        skewScale: BigNumber,
        liquidationLimitScalar: BigNumber
      ) => wei(makerFee.add(takerFee)).mul(skewScale).mul(liquidationLimitScalar).toBN();

      describe('maxLiquidatableCapacity', () => {
        it('should be calculated relative to makerFee/takerFee and skewScale', async () => {
          const { BfpMarketProxy } = systems();
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

          const { maxLiquidatableCapacity } =
            await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
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
            const { BfpMarketProxy } = systems();
            const market = genOneOf(markets());
            const marketId = market.marketId();

            const makerFee = bn(genNumber(0.0001, 0.0005));
            const takerFee = bn(genNumber(0.0006, 0.001));
            const skewScale = bn(1_000_000);

            const liquidationLimitScalar = bn(scalar);
            await setMarketConfigurationById(bs, marketId, {
              liquidationLimitScalar,
              makerFee,
              takerFee,
              skewScale,
            });

            const { maxLiquidatableCapacity } =
              await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
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

      describe('remainingCapacity', () => {
        it('should be updated to reflect a recent liquidation');

        it(
          'should be zero when cap has been met and an endorsed liquidator pushes past cap for window'
        );
      });
    });

    describe('{partialLiquidation,liquidationCapacity,liqKeeperFee}', () => {
      const configurePartiallyLiquidatedPosition = async (
        desiredFlagger?: Signer,
        desiredLiquidator?: Signer,
        desiredTrader?: Trader,
        desiredMarket?: Market,
        desiredMarginUsdDepositAmount: number = 50_000
      ) => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = desiredFlagger ?? keeper();
        const liquidationKeeper = desiredLiquidator ?? keeper();

        const flaggerKeeperAddr = await flaggerKeeper.getAddress();
        const liquidationKeeperAddr = await liquidationKeeper.getAddress();

        // Be quite explicit with what market and market params we are using to ensure a partial liquidation.
        const market = desiredMarket ?? markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(25_000));
        const orderSide = genSide();

        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, { desiredTrader, desiredMarket: market, desiredMarginUsdDepositAmount })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        //
        // This effectively gives us a liquidation max cap at 1.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(0.01),
          makerFee: bn(0.0001),
          takerFee: bn(0.0001),
          skewScale: bn(500_000),
        });

        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, 0);
        assertBn.lt(capBefore.remainingCapacity, collateralDepositAmount);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        await BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId);

        // Attempt the liquidate. This should complete successfully.
        const { tx, receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const positionLiquidatedEvent = findEventSafe(
          receipt,
          'PositionLiquidated',
          BfpMarketProxy
        );

        const remainingSize = order.sizeDelta.abs().sub(capBefore.remainingCapacity).mul(orderSide);
        const positionLiquidatedEventProperties = [
          trader.accountId,
          marketId,
          order.sizeDelta,
          remainingSize,
          `"${flaggerKeeperAddr}"`,
          `"${liquidationKeeperAddr}"`,
          positionLiquidatedEvent?.args.liqKeeperFee,
          newMarketOraclePrice,
        ].join(', ');
        await assertEvent(
          receipt,
          `PositionLiquidated(${positionLiquidatedEventProperties})`,
          BfpMarketProxy
        );

        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(capAfter.remainingCapacity);

        return {
          tx,
          receipt,
          marketId,
          market,
          order,
          orderSide,
          liquidatedSize: capBefore.remainingCapacity,
          remainingSize,
          trader,
          flaggerKeeper,
          liquidationKeeper,
        };
      };

      it('should partially liquidate and exhaust cap if position hits liq window cap', async () => {
        const { BfpMarketProxy } = systems();

        const { marketId } = await configurePartiallyLiquidatedPosition();
        const cap = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        assertBn.isZero(cap.remainingCapacity);
      });

      it('should partially update market skew/size when partially liquidated', async () => {
        const { BfpMarketProxy } = systems();

        const { remainingSize, marketId } = await configurePartiallyLiquidatedPosition();
        const d1 = await BfpMarketProxy.getMarketDigest(marketId);

        assertBn.equal(d1.size, remainingSize.abs());
        assertBn.equal(d1.skew, remainingSize);
      });

      it('should allow an endorsed keeper to fully liquidate a position even if above caps', async () => {
        const { BfpMarketProxy } = systems();

        const { trader, remainingSize, marketId } = await configurePartiallyLiquidatedPosition();

        // Should be fullt exhausted.
        const cap1 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap1.remainingCapacity);

        // Endorsed liqudaitor to liquidate remaining capacity.
        const d1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.equal(d1.position.size, remainingSize);

        await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(endorsedKeeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const d2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
        assertBn.isZero(d2.position.size);

        const cap2 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);
      });

      it('should allow further liquidations even if exceed caps when pd is below maxPd', async () => {
        const { BfpMarketProxy } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;
        const desiredMarginUsdDepositAmount = 50_000;

        const desiredKeeper = keeper();
        const desiredKeeperAddress = await desiredKeeper.getAddress();

        const {
          liquidatedSize,
          marketId,
          market,
          order: order1,
          orderSide: orderSide1,
        } = await configurePartiallyLiquidatedPosition(
          desiredKeeper,
          desiredKeeper,
          trader1,
          undefined,
          desiredMarginUsdDepositAmount
        );

        // Partially liquidated position.
        const cap = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap.remainingCapacity);

        // Open another position with the same to balance skew.
        await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader2,
            desiredMarket: market,
            desiredMarginUsdDepositAmount,
          })
        );

        // Inverted side to neutralize skew.
        const desiredOrderSize = liquidatedSize.mul(orderSide1 === 1 ? -1 : 1);
        const order = await genOrderFromSizeDelta(bs, market, desiredOrderSize);
        await commitAndSettle(bs, marketId, trader2, order);

        // Liquidate remaining size.
        const { receipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        const positionLiquidatedEvent = findEventSafe(
          receipt,
          'PositionLiquidated',
          BfpMarketProxy
        );

        // Partial liquidation (again) - not high enough cap to fully liquidate but did bypass liquidations.
        //
        // NOTE: We .mul(2) here because the position has been partially liquidated _twice_.
        const expectedSizeBeforeLiquidation = order1.sizeDelta
          .abs()
          .sub(liquidatedSize) // 1x liquidatedSize to account for the first liq.
          .mul(orderSide1);
        const expectedRemainingSize = order1.sizeDelta
          .abs()
          .sub(liquidatedSize.mul(2))
          .mul(orderSide1);
        const positionLiquidatedEventProperties = [
          trader1.accountId,
          marketId,
          expectedSizeBeforeLiquidation,
          expectedRemainingSize, // Remaining size to liquidate (none = dead).
          `"${desiredKeeperAddress}"`,
          `"${desiredKeeperAddress}"`,
          positionLiquidatedEvent?.args.liqKeeperFee,
          order.oraclePrice,
        ].join(', ');

        await assertEvent(
          receipt,
          `PositionLiquidated(${positionLiquidatedEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should progressively liquidate a large position by the window cap size when below maxPd', async () => {
        const { BfpMarketProxy } = systems();

        const trader = traders()[0];
        const otherTradersGenerator = toRoundRobinGenerators(shuffle(traders().slice(1)));

        const market = markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(10_000));
        const orderSide = genSide();
        const marginUsdDepositAmount = 16_000;

        // Create a significant position and flag for liquidation.
        const { marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // maxLiqCap = (makerFee + takerFee) * skewScale * limitScalar
        //           = (0.0002 + 0.0002) * 1000000 * 0.01
        //           = 4
        const liquidationLimitScalar = bn(0.01);
        const makerFee = bn(0.0002);
        const takerFee = bn(0.0002);
        const skewScale = bn(1_000_000);

        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar,
          makerFee,
          takerFee,
          skewScale,
        });
        const { maxLiquidatableCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        const expectedMaxLiquidatableCapacity = wei(makerFee.add(takerFee))
          .mul(skewScale)
          .mul(liquidationLimitScalar)
          .toBN();
        assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId);

        let position = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
        assertBn.equal(position.size.abs(), order.sizeDelta.abs());

        const expectedLiquidationIterations = Math.ceil(
          wei(position.size.abs()).div(maxLiquidatableCapacity).toNumber()
        );
        let liquidationIterations = 0;

        while (!position.size.isZero()) {
          // Attempt to liquidate.
          //
          // No caps would have been met on the first iteration.
          await withExplicitEvmMine(
            () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
            provider()
          );

          // Subsequent liquidation attempts should have reached cap.
          if (liquidationIterations > 0) {
            const { remainingCapacity } =
              await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
            assertBn.isZero(remainingCapacity);
          }

          // Resulting position's size should be oldPosition.size - maxLiquidatableCapacity
          const nextPosition = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
          const amountLiquidated = Wei.min(
            wei(position.size.abs()),
            wei(maxLiquidatableCapacity)
          ).toBN();
          assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(amountLiquidated));

          // Open an order in the opposite side to bring skew / skewScale < maxPd
          const otherTrader = otherTradersGenerator.next().value;

          const { collateral: oCollateral, collateralDepositAmount: ocollateralDepositAmount } =
            await depositMargin(
              bs,
              genTrader(bs, {
                desiredTrader: otherTrader,
                desiredMarket: market,
                desiredCollateral: getSusdCollateral(collaterals()),
                desiredMarginUsdDepositAmount: marginUsdDepositAmount,
              })
            );
          const order = await genOrder(bs, market, oCollateral, ocollateralDepositAmount, {
            desiredSize: amountLiquidated.mul(orderSide).mul(orderSide), // .mul . mul to ensure we're on the opposite side.
            desiredKeeperFeeBufferUsd: 0,
          });
          await commitAndSettle(bs, marketId, otherTrader, order);

          liquidationIterations += 1;
          position = nextPosition;

          // Give the RPC some time to calm down. If we spam too much, it can error out.
          await sleep(500);
        }

        assert.equal(liquidationIterations, expectedLiquidationIterations);
      });

      it('should not liquidate more than position size', async () => {
        const { BfpMarketProxy } = systems();

        const trader1 = traders()[0];
        const trader2 = traders()[1];

        const market = markets()[0];
        await market.aggregator().mockSetCurrentPrice(bn(10_000));
        const orderSide = genSide();
        const marginUsdDepositAmount = 16_000;

        // Create a significant position and flag for liquidation.
        const { marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader1,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader1, order1);

        // maxLiqCap = (makerFee + takerFee) * skewScale * limitScalar
        //           = (0.0002 + 0.0002) * 1000000 * 0.01
        //           = 4
        const liquidationLimitScalar = bn(0.01);
        const makerFee = bn(0.0002);
        const takerFee = bn(0.0002);
        const skewScale = bn(1_000_000);

        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar,
          makerFee,
          takerFee,
          skewScale,
        });
        const { maxLiquidatableCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        const expectedMaxLiquidatableCapacity = wei(makerFee.add(takerFee))
          .mul(skewScale)
          .mul(liquidationLimitScalar)
          .toBN();
        assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);

        // Price moves 10% and results in a healthFactor of < 1.
        const newMarketOraclePrice = wei(order1.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        await BfpMarketProxy.connect(keeper()).flagPosition(trader1.accountId, marketId);

        const position = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        assertBn.equal(position.size.abs(), order1.sizeDelta.abs());

        // Use up the entire liqCap.
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        // Confirm cap is zero.
        const { remainingCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(remainingCapacity);

        // Resulting position's size should be oldPosition.size - maxLiquidatableCapacity
        let nextPosition = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        const amountLiquidated = Wei.min(
          wei(position.size.abs()),
          wei(maxLiquidatableCapacity)
        ).toBN();

        assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(amountLiquidated));

        // Open an order in the opposite side to bring skew / skewScale < maxPd
        const { collateral: oCollateral, collateralDepositAmount: ocollateralDepositAmount } =
          await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: trader2,
              desiredMarket: market,
              desiredCollateral: getSusdCollateral(collaterals()),
              desiredMarginUsdDepositAmount: wei(amountLiquidated)
                .mul(newMarketOraclePrice)
                .toNumber(),
            })
          );
        const order = await genOrder(bs, market, oCollateral, ocollateralDepositAmount, {
          desiredSize: amountLiquidated.mul(orderSide).mul(orderSide),
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader2, order);

        // Attempt to liquidate again, bypassing caps. This should liquidate at most maxCap.
        await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader1.accountId, marketId),
          provider()
        );

        // Confirm the position is _not_ completely liquidated `.mul(2)` because we've made 2 explicit liquidations.
        const totalAmountLiquidated = Wei.min(
          wei(position.size.abs()),
          wei(maxLiquidatableCapacity).mul(2)
        ).toBN();
        nextPosition = await BfpMarketProxy.getPositionDigest(trader1.accountId, marketId);
        assertBn.gt(nextPosition.size.abs(), bn(0));
        assertBn.equal(nextPosition.size.abs(), position.size.abs().sub(totalAmountLiquidated));
      });

      it('should reset caps after window timeframe has elapsed', async () => {
        const { BfpMarketProxy } = systems();

        const { marketId } = await configurePartiallyLiquidatedPosition();

        // NOTE: We make an assumption about the configured liquidationWindowDuration.
        //
        // We know that this value is defined as 30s. If this changes then this test will most likely
        // break and this comment will be served as a notice.
        const { liquidationWindowDuration } =
          await BfpMarketProxy.getMarketConfigurationById(marketId);

        // Caps before moving time forward.
        const cap1 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap1.remainingCapacity);

        await fastForwardBySec(provider(), 15); // Half way into cap.

        const cap2 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap2.remainingCapacity);

        await fastForwardBySec(provider(), 14); // One second before end of cap.

        const cap3 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(cap3.remainingCapacity);

        await fastForwardBySec(provider(), 1); // Exact 30s.

        const cap4 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap4.remainingCapacity, cap4.maxLiquidatableCapacity);

        await fastForwardBySec(provider(), 5); // 5s into new window.

        const cap5 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap5.remainingCapacity, cap5.maxLiquidatableCapacity);

        await fastForwardBySec(provider(), liquidationWindowDuration.toNumber()); // > window over.

        const cap6 = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.equal(cap6.remainingCapacity, cap6.maxLiquidatableCapacity);
      });

      it('should pay out liquidation fee to liquidator in chunks added up to total', async () => {
        const { BfpMarketProxy } = systems();

        const marketOraclePrice1 = bn(10_000);
        const market = markets()[0];
        const collateral = getSusdCollateral(collaterals());
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice1);

        // Open a decently large position that would result in a partial liquidation.
        const { trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredMarginUsdDepositAmount: 100_000,
            desiredCollateral: collateral,
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: 1,
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // Reconfigure market to lower the remainingCapacity such that it's < collateralDepositAmount but > 0.
        //
        // This effectively gives us a liquidation max cap at 1.

        const globalConfig = await setMarketConfiguration(bs, {
          maxKeeperFeeUsd: bn(100_000), // really large max as we're testing chunking not max
        });

        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        assertBn.gt(capBefore.remainingCapacity, 0);
        assertBn.lt(capBefore.remainingCapacity, collateralDepositAmount);

        // Price moves 10% and results in a healthFactor of < 1.
        //
        // 10k -> 9k
        const marketOraclePrice2 = wei(marketOraclePrice1).mul(0.9).toBN();
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice2);

        const baseFeePerGas = await setBaseFeePerGas(0, provider());

        const { liqKeeperFee } = await BfpMarketProxy.getLiquidationFees(
          trader.accountId,
          marketId
        );

        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
        const expectedLiqFee = calcLiquidationKeeperFee(
          ethPrice,
          baseFeePerGas,
          wei(order.sizeDelta).abs(),
          wei(capBefore.maxLiquidatableCapacity),
          globalConfig
        );
        assertBn.equal(expectedLiqFee.toBN(), liqKeeperFee);

        // Dead.
        await BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId, {
          maxPriorityFeePerGas: 0,
        });

        let accLiqRewards = bn(0);
        let remainingSize = bn(-1);

        // Perform enough partial liquidations until fully liquidated.
        while (!remainingSize.isZero()) {
          const { receipt } = await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
                maxPriorityFeePerGas: 0,
              }),
            provider()
          );
          const { liqKeeperFee, remainingSize: _remSize } = findEventSafe(
            receipt,
            'PositionLiquidated',
            BfpMarketProxy
          ).args;

          accLiqRewards = accLiqRewards.add(liqKeeperFee);
          remainingSize = _remSize;
        }
        // `sum(liqReward)` should equal to liqReward from the prior step.
        assertBn.equal(accLiqRewards, expectedLiqFee.toBN());
      });

      it('should cap liqKeeperFee and flagKeeperReward to the maxKeeperFee', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();
        // keeperProfitMarginUsd set to 10, maxKeeperFeeUsd set to 1 means no matter the size of the pos, maxKeeperFeeUsd will be used as that's the determining factor
        await setMarketConfiguration(bs, {
          maxKeeperFeeUsd: bn(1),
          keeperProfitMarginUsd: bn(10),
        });

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );
        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId),
          provider()
        );

        const { flagKeeperReward } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;

        assertBn.equal(flagKeeperReward, bn(1));
        assertBn.equal(liqKeeperFee, bn(1));
      });

      it('should use keeperProfitMarginPercent when bigger than keeperProfitMarginUsd', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs, { desiredMarginUsdDepositAmount: 1000 }));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10, // 10k pos
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);

        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        const { keeperProfitMarginPercent, keeperLiquidationGasUnits, keeperFlagGasUnits } =
          await setMarketConfiguration(bs, {
            maxKeeperFeeUsd: bn(1234567), // large max fee to make sure it's not used
            keeperProfitMarginUsd: bn(0), // ensure keeperProfitMarginPercent would be used instead
            keeperLiquidationGasUnits: 500_000,
            keeperFlagGasUnits: 500_000,
          });

        const { liquidationRewardPercent: flagRewardPercent } = await setMarketConfigurationById(
          bs,
          marketId,
          {
            liquidationRewardPercent: bn(0.0001), // really small so we dont hit maxKeeperFeeUsd
          }
        );

        // Set baseFeePerGas to 1gwei
        const baseFeePerGas = await setBaseFeePerGas(1, provider());

        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );
        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

        // Set baseFeePerGas to 1 gwei again
        await setBaseFeePerGas(1, provider());
        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
              maxPriorityFeePerGas: 0, // no priority fee to keep things simple
            }),
          provider()
        );

        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;
        const { flagKeeperReward, flaggedPrice } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const sizeAbsUsd = wei(order.sizeDelta).abs().mul(flaggedPrice);
        const expectedCostFlag = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperFlagGasUnits,
          ethPrice
        );
        const expectedFlagReward = wei(expectedCostFlag)
          .mul(wei(1).add(keeperProfitMarginPercent))
          .add(sizeAbsUsd.mul(flagRewardPercent));

        assertBn.equal(flagKeeperReward, expectedFlagReward.toBN());

        const expectedCostLiq = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperLiquidationGasUnits,
          ethPrice
        );
        const expectedKeeperFee = wei(expectedCostLiq).mul(wei(1).add(keeperProfitMarginPercent));

        assertBn.equal(liqKeeperFee, wei(expectedKeeperFee).toBN());
      });

      it('should use keeperProfitMarginUsd when keeperProfitMarginPercent is small', async () => {
        const { BfpMarketProxy } = systems();

        const orderSide = genSide();

        const { trader, market, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs, { desiredMarginUsdDepositAmount: 1000 }));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 10, // 10k pos
          desiredSide: orderSide,
        });

        await commitAndSettle(bs, marketId, trader, order);
        // Price falls/rises between 10% should results in a healthFactor of < 1.
        // Whether it goes up or down depends on the side of the order.
        const newMarketOraclePrice = wei(order.oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
        const { keeperProfitMarginUsd, keeperLiquidationGasUnits, keeperFlagGasUnits } =
          await setMarketConfiguration(bs, {
            maxKeeperFeeUsd: bn(1234567), // large max fee to make sure it's not used
            keeperProfitMarginPercent: bn(0.00001), // small margin percent to ensure we use keeperProfitMarginUsd
            keeperLiquidationGasUnits: 500_000,
            keeperFlagGasUnits: 500_000,
          });

        const { liquidationRewardPercent: flagRewardPercent } = await setMarketConfigurationById(
          bs,
          marketId,
          {
            liquidationRewardPercent: bn(0.0001), // really small so we dont hit maxKeeperFeeUsd
          }
        );
        // Set baseFeePerGas to 1gwei
        await setBaseFeePerGas(0, provider());
        const { receipt: flagReceipt } = await withExplicitEvmMine(
          () => BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          provider()
        );

        const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();

        // Set baseFeePerGas to 1gwei
        const baseFeePerGas = await setBaseFeePerGas(0, provider());

        const { receipt: liqReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(keeper()).liquidatePosition(trader.accountId, marketId, {
              maxPriorityFeePerGas: 0, // no priority fee to keep things simple
            }),
          provider()
        );

        const { flagKeeperReward, flaggedPrice } = findEventSafe(
          flagReceipt,
          'PositionFlaggedLiquidation',
          BfpMarketProxy
        ).args;
        const { liqKeeperFee } = findEventSafe(
          liqReceipt,
          'PositionLiquidated',
          BfpMarketProxy
        ).args;
        const sizeAbsUsd = wei(order.sizeDelta).abs().mul(flaggedPrice);
        const expectedCostFlag = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperFlagGasUnits,
          ethPrice
        );
        const expectedFlagReward = wei(expectedCostFlag)
          .add(wei(keeperProfitMarginUsd))
          .add(sizeAbsUsd.mul(flagRewardPercent));

        assertBn.equal(flagKeeperReward, expectedFlagReward.toBN());

        const expectedCostLiq = calcTransactionCostInUsd(
          baseFeePerGas,
          keeperLiquidationGasUnits,
          ethPrice
        );
        const expectedKeeperFee = wei(expectedCostLiq).add(wei(keeperProfitMarginUsd));

        assertBn.equal(liqKeeperFee, wei(expectedKeeperFee).toBN());
      });

      it('should result in a higher liqReward if market price moves in favour of position');

      it('should result in a lower liqReward if market moves unfavourably of position');

      it('should use up cap (partial) before exceeding if pd < maxPd');

      it('should track and include endorsed keeper activity (cap + time) on liquidations', async () => {
        const { BfpMarketProxy } = systems();

        // Use the endorsed keeper to liquidate.
        const keeper = endorsedKeeper();
        const market = markets()[0];
        const marketId = market.marketId();

        const d1 = await BfpMarketProxy.getMarketDigest(marketId);

        await configurePartiallyLiquidatedPosition(keeper, keeper, undefined, market);

        const d2 = await BfpMarketProxy.getMarketDigest(marketId);

        // Last liquidation time is the current block (i.e. the time the position was liquidated).
        assertBn.isZero(d1.lastLiquidationTime);
        assertBn.equal((await provider().getBlock('latest')).timestamp, d2.lastLiquidationTime);

        // Ensure the capacity is also updated to reflect the liquidation.
        assertBn.gt(d1.remainingLiquidatableSizeCapacity, d2.remainingLiquidatableSizeCapacity);
      });

      it('should not remove flagger on partial liquidation', async () => {
        const { BfpMarketProxy } = systems();

        const { trader, marketId } = await configurePartiallyLiquidatedPosition();

        // Partially liquidated and should still remain flagged. A re-flat should not be allowed.
        await assertRevert(
          BfpMarketProxy.connect(keeper()).flagPosition(trader.accountId, marketId),
          `PositionFlagged()`,
          BfpMarketProxy
        );
      });

      it('should accumulate liq utilization without exceeding cap', async () => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = keeper();
        const liquidationKeeper = keeper2();

        // Ensure we use the same side and market for all traders.
        const orderSide = genSide();
        const market = genOneOf(markets());
        const marketId = market.marketId();

        // Set a fairly large liquidation limit scalar to prevent partial liquidations. Also give a large enough
        // window to ensure liquidations all occur within one window.
        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar: bn(10),
          liquidationWindowDuration: 60,
        });

        const orders: Awaited<ReturnType<typeof genOrder>>[] = [];

        // For two traders, open a position (both on the same side) and liquidate everything. The
        // sum of all sizeDelta should be the utilization and remaining should be max - utilization.
        const tradersToUse = traders().slice(0, 2);

        for (const trader of tradersToUse) {
          const marginUsdDepositAmount = genOneOf([1000, 5000, 10_000]);
          const collateral = genOneOf(collaterals());

          const { collateralDepositAmount: collateralDepositAmount1 } = await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: trader,
              desiredCollateral: collateral,
              desiredMarket: market,
              desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            })
          );
          const order = await genOrder(bs, market, collateral, collateralDepositAmount1, {
            desiredLeverage: 10,
            desiredSide: orderSide,
          });
          await commitAndSettle(bs, marketId, trader, order);

          orders.push(order);
        }

        const sizeToLiquidate = orders.reduce(
          (acc, order) => acc.add(order.sizeDelta.abs()),
          bn(0)
        );

        // Verify that liquidating both will not incur any caps.
        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, sizeToLiquidate);

        // Place both traders into liquidation.
        const oraclePrice = await BfpMarketProxy.getOraclePrice(marketId);
        const newMarketOraclePrice = wei(oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Flag and liquidate it all.
        for (const trader of tradersToUse) {
          await withExplicitEvmMine(
            () => BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader.accountId, marketId),
            provider()
          );
          await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
                trader.accountId,
                marketId
              ),
            provider()
          );
        }

        // Ensure both liquidations occurred on the same block.
        assertBn.isZero((await BfpMarketProxy.getMarketDigest(marketId)).size);

        // Ensure both were fully liquidated.
        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        // Ensure caps have not changed between liquidations.
        assertBn.equal(capBefore.maxLiquidatableCapacity, capAfter.maxLiquidatableCapacity);
        assertBn.equal(
          capAfter.remainingCapacity,
          capAfter.maxLiquidatableCapacity.sub(sizeToLiquidate)
        );

        // Verify internal accounting tracks correct liquidation time and amount.
        const { remainingLiquidatableSizeCapacity } =
          await BfpMarketProxy.getMarketDigest(marketId);
        assertBn.equal(
          capAfter.maxLiquidatableCapacity.sub(remainingLiquidatableSizeCapacity),
          sizeToLiquidate
        );
      });

      it('should accumulate an into existing liquidation chunk if two tx in the same block', async () => {
        const { BfpMarketProxy } = systems();

        const flaggerKeeper = keeper();
        const liquidationKeeper = keeper2();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;

        const orderSide = genSide();
        const marginUsdDepositAmount = 15_000;
        const collateral = collaterals()[0]; // sUSD
        const market = markets()[0];
        const marketId = market.marketId();

        // Set a fairly large liquidation limit scalar to prevent partial liquidations.
        await setMarketConfigurationById(bs, marketId, { liquidationLimitScalar: bn(10) });

        // Trader 1.
        const { collateralDepositAmount: collateralDepositAmount1 } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader1,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order1 = await genOrder(bs, market, collateral, collateralDepositAmount1, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader1, order1);

        // Trader 2.
        const { collateralDepositAmount: collateralDepositAmount2 } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: trader2,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );
        const order2 = await genOrder(bs, market, collateral, collateralDepositAmount2, {
          desiredLeverage: 10,
          desiredSide: orderSide,
        });
        await commitAndSettle(bs, marketId, trader2, order2);

        const sizeToLiquidate = order1.sizeDelta.abs().add(order2.sizeDelta.abs());

        // Verify that liquidating both will not incur any caps.
        const capBefore = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.gt(capBefore.remainingCapacity, sizeToLiquidate);

        // Place both traders into liquidation.
        const oraclePrice = order1.oraclePrice;
        const newMarketOraclePrice = wei(oraclePrice)
          .mul(orderSide === 1 ? 0.9 : 1.1)
          .toBN();
        await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

        // Flag both users for liquidation.
        await BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader1.accountId, marketId);
        await BfpMarketProxy.connect(flaggerKeeper).flagPosition(trader2.accountId, marketId);

        // Attempt to liquidate both in a single block.
        await provider().send('evm_setAutomine', [false]);

        const tx1 = await BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
          trader1.accountId,
          marketId
        );
        const tx2 = await BfpMarketProxy.connect(liquidationKeeper).liquidatePosition(
          trader2.accountId,
          marketId
        );

        await provider().send('evm_setAutomine', [true]);

        const receipt1 = await tx1.wait();
        const receipt2 = await tx2.wait();

        // Ensure both liquidations occurred on the same block.
        assert.equal(receipt1.blockNumber, receipt2.blockNumber);
        assert.equal(tx1.timestamp, tx2.timestamp);
        assertBn.isZero((await BfpMarketProxy.getMarketDigest(marketId)).size);

        // Ensure both were fully liquidated.
        const capAfter = await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

        // Ensure caps have not changed between liquidations.
        assertBn.equal(capBefore.maxLiquidatableCapacity, capAfter.maxLiquidatableCapacity);
        assertBn.equal(
          capAfter.remainingCapacity,
          capAfter.maxLiquidatableCapacity.sub(sizeToLiquidate)
        );

        // Verify internal accounting tracks correct liquidation time and amount.
        const block = await provider().getBlock(receipt1.blockNumber);
        const { lastLiquidationTime, remainingLiquidatableSizeCapacity } =
          await BfpMarketProxy.getMarketDigest(marketId);
        assertBn.equal(lastLiquidationTime, block.timestamp);
        assertBn.equal(
          capAfter.maxLiquidatableCapacity.sub(remainingLiquidatableSizeCapacity),
          sizeToLiquidate
        );
      });

      it('should revert when liq cap has been met and not endorsed', async () => {
        const { BfpMarketProxy } = systems();

        const desiredKeeper = keeper(); // NOT endorsed.
        const { trader, marketId } = await configurePartiallyLiquidatedPosition(
          desiredKeeper,
          desiredKeeper
        );

        // Confirm we have exhausted caps.
        const { remainingCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        assertBn.isZero(remainingCapacity);

        // Do not allow bypass unless market is _perfectly_ balanced. Adding this here to prevent maxPd bypass.
        await setMarketConfigurationById(bs, marketId, { liquidationMaxPd: bn(0) });

        // Attempt to liquidate again.
        await assertRevert(
          BfpMarketProxy.connect(desiredKeeper).liquidatePosition(trader.accountId, marketId),
          `LiquidationZeroCapacity()`,
          BfpMarketProxy
        );
      });

      // TODO: A concrete test with many whales all trading but one has over extended, partially liqudated.
      it('should revert when liq cap has been met and not endorsed (concrete)');

      it('should revert when pd is below maxPd but liquidation happens in the same block');
    });
  });

  describe('getLiquidationMarginUsd', () => {
    const calcImrAndMmr = (size: Wei, marketConfig: PerpMarketConfiguration.DataStructOutput) => {
      const imr = Wei.min(
        size
          .abs()
          .div(marketConfig.skewScale)
          .mul(marketConfig.incrementalMarginScalar)
          .add(marketConfig.minMarginRatio),
        wei(marketConfig.maxInitialMarginRatio)
      );
      const mmr = imr.mul(marketConfig.maintenanceMarginScalar);
      return { imr, mmr };
    };

    it('should revert when invalid marketId', async () => {
      const { BfpMarketProxy } = systems();
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.getLiquidationMarginUsd(0, invalidMarketId, 0),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when invalid accountId', async () => {
      const { BfpMarketProxy } = systems();
      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;
      await assertRevert(
        BfpMarketProxy.getLiquidationMarginUsd(invalidAccountId, marketId, 0),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should return 0 when no position found', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        0
      );

      assertBn.isZero(mm);
      assertBn.isZero(im);
    });

    it('should calculate IM and MM for existing position', async () => {
      const { BfpMarketProxy } = systems();
      const {
        market,
        collateral,
        collateralDepositAmount,
        marketId,
        trader,
        marginUsdDepositAmount,
      } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const baseFeePerGas = await setBaseFeePerGas(0, provider());

      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        0
      );

      // Data for calcs.
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const absSize = wei(order.sizeDelta).abs();
      const notional = absSize.mul(order.oraclePrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(order.oraclePrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should calculate IM and MM for new position', async () => {
      const { BfpMarketProxy } = systems();
      const { market, collateralDepositAmount, marketId, trader, marginUsdDepositAmount } =
        await depositMargin(bs, genTrader(bs));

      const { answer: marketPrice } = await market.aggregator().latestRoundData();
      const desiredLeverage = genNumber(-5, 5);
      const desiredSize = wei(collateralDepositAmount).div(marketPrice).mul(desiredLeverage).toBN();
      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSize
      );

      // Data for calcs.
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const absSize = wei(desiredSize).abs();
      const notional = absSize.mul(marketPrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should calculate IM and MM for modifying a position', async () => {
      const { BfpMarketProxy } = systems();
      const {
        market,
        collateral,
        collateralDepositAmount,
        marketId,
        trader,
        marginUsdDepositAmount,
      } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const desiredSizeDelta = bn(genNumber(-1, 1));
      const baseFeePerGas = await setBaseFeePerGas(0, provider());
      const { mm, im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSizeDelta
      );

      // Data for calcs
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const size = order.sizeDelta.add(desiredSizeDelta);
      const absSize = wei(size).abs();
      const notional = absSize.mul(marketPrice);
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        absSize,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      const { imr, mmr } = calcImrAndMmr(absSize, marketConfig);

      const expectedIm = notional
        .mul(imr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);
      const expectedMm = notional
        .mul(mmr)
        .add(marketConfig.minMarginUsd)
        .add(liqReward)
        .add(flagReward);

      assertBn.near(im, expectedIm.toBN(), bn(0.000001));
      assertBn.near(mm, expectedMm.toBN(), bn(0.000001));
    });

    it('should cap IMR (and hence IM) by the maxInitialMarginRatio (concrete)', async () => {
      const { BfpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      await collateral.setPrice(bn(50_000));

      const { market, marketId, trader, marginUsdDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarginUsdDepositAmount: 3_000_000_000, // 3b position
          desiredCollateral: collateral,
        })
      );

      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const desiredSizeDelta = wei(marginUsdDepositAmount).div(wei(marketPrice)).neg().toBN(); // 1x short

      const baseFeePerGas = await setBaseFeePerGas(0, provider());

      const { im } = await BfpMarketProxy.getLiquidationMarginUsd(
        trader.accountId,
        marketId,
        desiredSizeDelta
      );

      // Data for calcs
      const marketConfig = await BfpMarketProxy.getMarketConfigurationById(marketId);
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const globalConfig = await BfpMarketProxy.getMarketConfiguration();
      const { maxLiquidatableCapacity } =
        await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);

      const size = wei(desiredSizeDelta).abs();
      const notional = size.mul(marketPrice);

      const flagReward = calcFlagReward(
        ethPrice,
        baseFeePerGas,
        size,
        wei(marketPrice),
        wei(marginUsdDepositAmount),
        globalConfig,
        marketConfig
      );
      const liqReward = calcLiquidationKeeperFee(
        ethPrice,
        baseFeePerGas,
        size,
        wei(maxLiquidatableCapacity),
        globalConfig
      );
      // Expect the IMR to be at maxInitialMarginRatio cap.
      const imr = wei(marketConfig.maxInitialMarginRatio);
      const expectedIm = notional
        .mul(imr)
        .add(wei(marketConfig.minMarginUsd))
        .add(liqReward)
        .add(flagReward);
      console.log({
        flagReward: flagReward.toNumber(),
        liqReward: liqReward.toNumber(),
        im: wei(im).toNumber(),
        expectedIm: expectedIm.toNumber(),
        diff: wei(im).sub(expectedIm).toNumber(),
      });
      assertBn.equal(im, expectedIm.toBN());
    });

    it('should allow a position to always 1x even when extremely large', async () => {
      const { BfpMarketProxy } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();
      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      const trader = genOneOf(traders());

      // 1M per token to avoid exceeding maxAllowable.
      const collateral = genOneOf(collateralsWithoutSusd());
      await collateral.setPrice(bn(1_000_000));

      let accumulatedDepositUsd = wei(0);

      for (let i = 0; i < 10; i++) {
        const desiredMarginUsdDepositAmount = genNumber(420_000_000, 690_000_000);
        const { marginUsdDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarginUsdDepositAmount,
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredTrader: trader,
          })
        );
        accumulatedDepositUsd = accumulatedDepositUsd.add(marginUsdDepositAmount);

        const desiredSizeDelta = wei(accumulatedDepositUsd).div(wei(marketPrice)).neg().toBN(); // 1x short
        const { im } = await BfpMarketProxy.getLiquidationMarginUsd(
          trader.accountId,
          marketId,
          desiredSizeDelta
        );

        // Expect the IM to always be below the total deposited margin.
        assertBn.lt(im, accumulatedDepositUsd.toBN());
      }
    });
  });
});
