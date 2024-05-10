import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import Wei, { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { calcPricePnl, calcTransactionCostInUsd } from '../../calculations';
import {
  bn,
  genBootstrap,
  genNumber,
  genOneOf,
  genOrder,
  genSide,
  genTrader,
} from '../../generators';
import {
  ADDRESS0,
  MaxUint128,
  SECONDS_ONE_DAY,
  commitAndSettle,
  depositMargin,
  fastForwardBySec,
  findEventSafe,
  getSusdCollateral,
  mintAndApprove,
  setBaseFeePerGas,
  setMarketConfiguration,
  withExplicitEvmMine,
} from '../../helpers';

describe('MarginModule Debt', async () => {
  const bs = bootstrap(genBootstrap());
  const { collaterals, collateralsWithoutSusd, systems, provider, restore, keeper } = bs;

  beforeEach(restore);

  describe('payDebt', () => {
    it('should revert when 0 amount', async () => {
      const { BfpMarketProxy } = systems();

      await assertRevert(BfpMarketProxy.payDebt(1, 2, 0), 'ZeroAmount', BfpMarketProxy);
    });

    it('should revert if account does not exists or missing permission', async () => {
      const { BfpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.payDebt(invalidAccountId, 2, 1),
        `PermissionDenied("${invalidAccountId}"`,
        BfpMarketProxy
      );
    });

    it('should revert if market does not exists', async () => {
      const { BfpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).payDebt(trader.accountId, invalidMarketId, 1),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when no debt', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, bn(100)),
        'NoDebt()',
        BfpMarketProxy
      );
    });

    it('should revert when sUSD is not approved', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, MaxUint128),
        'InsufficientAllowance',
        BfpMarketProxy
      );
    });

    it('should revert not enough balance', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      // Ensure trader doesn't have any sUSD
      const sUSD = getSusdCollateral(collaterals());
      const sUSDBalance = await sUSD.contract
        .connect(trader.signer)
        .balanceOf(await trader.signer.getAddress());
      if (sUSDBalance.gt(0)) {
        await sUSD.contract.connect(trader.signer).transfer(ADDRESS0, sUSDBalance);
      }

      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });

      const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);
      const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy);

      // Make sure we have some debt
      assertBn.gt(closeOrderEvent.args.accountDebt, 0);

      await sUSD.contract.connect(trader.signer).approve(BfpMarketProxy.address, MaxUint128);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).payDebt(
          trader.accountId,
          marketId,
          closeOrderEvent.args.accountDebt
        ),
        'InsufficientBalance',
        BfpMarketProxy
      );
    });

    it('should remove debt and emit event for non usd collateral', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
          desiredMarginUsdDepositAmount: 10_000,
        })
      );

      // Before doing anything, verify this trader has zero debt.
      const d1 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(d1.debtUsd);

      const orderSide = genSide();
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
        desiredSide: orderSide,
      });
      const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

      // Price moves, causing a 10% loss.
      const newMarketOraclePrice = wei(openOrder.oraclePrice)
        .mul(orderSide === 1 ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);

      // Fast forward to accrue utilization and funding.
      await fastForwardBySec(provider(), SECONDS_ONE_DAY);

      // Close the position at a loss.
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

      const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', BfpMarketProxy);
      const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy);

      // Total order/keeper fees incurred to open and close position.
      const fees = wei(openOrderEvent?.args.orderFee)
        .add(openOrderEvent?.args.keeperFee)
        .add(closeOrderEvent?.args.orderFee)
        .add(closeOrderEvent?.args.keeperFee);

      const expectedAccountDebtUsd = wei(
        calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice)
      )
        .sub(fees)
        .add(closeOrderEvent.args.accruedFunding)
        .sub(closeOrderEvent.args.accruedUtilization)
        .abs()
        .toBN();

      // We have accrued funding and utilization.
      // assertBn.notEqual(closeOrderEvent.args.accruedFunding, 0);
      // assertBn.notEqual(closeOrderEvent.args.accruedUtilization, 0);

      // Amount of debt on emitted matches current reported digest.
      const d2 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.equal(d2.debtUsd, closeOrderEvent.args.accountDebt);

      // The account's debt should account for all the fees and pnl.
      assertBn.near(expectedAccountDebtUsd, closeOrderEvent.args.accountDebt, bn(0.001));

      // Mint an exact amount of sUSD to pay the accountDebt.
      await mintAndApprove(
        bs,
        getSusdCollateral(collaterals()), // sUSD
        closeOrderEvent.args.accountDebt,
        trader.signer
      );
      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(trader.signer).payDebt(
            trader.accountId,
            marketId,
            closeOrderEvent.args.accountDebt
          ),
        provider()
      );
      await assertEvent(
        receipt,
        `DebtPaid(${trader.accountId}, ${marketId}, ${d2.debtUsd}, 0, 0)`,
        BfpMarketProxy
      );

      // All debt paid off.
      const d3 = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(d3.debtUsd);
    });

    it('should allow max sending a bigger amount than the debt', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      const { debtUsd: debtBefore } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.gt(debtBefore, bn(0));

      const sUSD = getSusdCollateral(collaterals());

      await mintAndApprove(bs, sUSD, debtBefore, trader.signer);
      await BfpMarketProxy.connect(trader.signer).payDebt(
        trader.accountId,
        marketId,
        debtBefore.mul(2)
      );

      const { debtUsd: debtAfter } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.isZero(debtAfter);
    });
    it('should remove debt using sUSD collateral when user have some', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      // Make sure we have some debt
      const { debtUsd: debtBefore } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.gt(debtBefore, bn(0));

      const sUSDcollateral = getSusdCollateral(collaterals());

      // Add sUSD balance and some sUSD collateral
      const amountToBePaidOffByCollateral = bn(genNumber(1, wei(debtBefore).toNumber()));
      // Make sure we have a little more sUSD than debt, this means our assertion assert that sUSD collateral is used before balance.
      const extraSUSDBalance = genNumber(1, 10);
      await mintAndApprove(bs, sUSDcollateral, debtBefore.add(extraSUSDBalance), trader.signer);
      await withExplicitEvmMine(
        () =>
          // Perform the deposit.
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            sUSDcollateral.address(),
            amountToBePaidOffByCollateral
          ),
        bs.provider()
      );

      const sUSDBalanceBefore = await sUSDcollateral.contract.balanceOf(
        await trader.signer.getAddress()
      );

      // Make sure sUSD balance is less than debt
      assertBn.lt(sUSDBalanceBefore, debtBefore);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, MaxUint128),
        provider()
      );

      const debtPaidEvent = findEventSafe(receipt, 'DebtPaid', BfpMarketProxy);
      const { debtUsd: debtAfter } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );

      // Assert events
      assertBn.equal(debtPaidEvent.args.newDebt, debtAfter);
      assertBn.equal(debtPaidEvent.args.paidFromUsdCollateral, amountToBePaidOffByCollateral);
      assertBn.equal(debtPaidEvent.args.oldDebt, debtBefore);

      const sUSDBalanceAfter = await sUSDcollateral.contract.balanceOf(
        await trader.signer.getAddress()
      );

      // Assert debt and sUSD balance
      assertBn.isZero(debtAfter);
      assertBn.equal(sUSDBalanceAfter, extraSUSDBalance);
    });
  });

  describe('isMarginLiquidatable', () => {
    it('should revert on invalid market id', async () => {
      const { BfpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).isMarginLiquidatable(
          trader.accountId,
          invalidMarketId
        ),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert on invalid account id', async () => {
      const { BfpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.isMarginLiquidatable(invalidAccountId, 2),
        `AccountNotFound("${invalidAccountId}"`,
        BfpMarketProxy
      );
    });

    it('should return false if we have a position', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);

      const isMarginLiquidatable = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatable, false);
    });

    it('should return false when account has no collateral', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId } = await genTrader(bs);
      const isMarginLiquidatable = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatable, false);
    });

    it('should return true when margin can be liquidated due to keeper fees', async () => {
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
        // Increase price 0.1% to make the margin not liquidatable unless keeper fees are turned on.
        .mul(1.001);
      await collateral.setPrice(newCollateralPrice.toBN());

      // Turn off collateral discount and keeper fees.
      await setMarketConfiguration(bs, { maxKeeperFeeUsd: 0, maxCollateralDiscount: bn(0) });

      const isMarginLiquidatableWithNoKeeperFees = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      // Should not be liquidatable without keeper fees.
      assert.equal(isMarginLiquidatableWithNoKeeperFees, false);

      // Add back keeper fees.
      await setMarketConfiguration(bs, { maxKeeperFeeUsd: bn(100) });

      const isMarginLiquidatable = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      // Should be liquidatable with keeper fees.
      assert.equal(isMarginLiquidatable, true);
    });

    it('should return true when margin can be liquidated', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount, collateralPrice } =
        await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
        );
      // Ensure trader doesn't have any sUSD
      const sUSD = getSusdCollateral(collaterals());
      const sUSDBalance = await sUSD.contract
        .connect(trader.signer)
        .balanceOf(await trader.signer.getAddress());
      if (sUSDBalance.gt(0)) {
        await sUSD.contract.connect(trader.signer).transfer(ADDRESS0, sUSDBalance);
      }

      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      const isMarginLiquidatableBefore = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatableBefore, false);

      await collateral.setPrice(wei(collateralPrice).mul(0.01).toBN());

      const isMarginLiquidatableAfter = await BfpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );

      assert.equal(isMarginLiquidatableAfter, true);
    });
  });

  describe('liquidateMarginOnly', () => {
    it('should revert on invalid market id', async () => {
      const { BfpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).liquidateMarginOnly(
          trader.accountId,
          invalidMarketId
        ),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should revert on invalid account id', async () => {
      const { BfpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        BfpMarketProxy.liquidateMarginOnly(invalidAccountId, 2),
        `AccountNotFound("${invalidAccountId}"`,
        BfpMarketProxy
      );
    });

    it('should revert when there is an open a position', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      await commitAndSettle(bs, marketId, trader, openOrder);
      const posDigest = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);

      assertBn.notEqual(posDigest.size, 0);

      await assertRevert(
        BfpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        `CannotLiquidateMargin()`,
        BfpMarketProxy
      );
    });

    it('should revert if margin cant be liquidated', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      // accrue some debt
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      await assertRevert(
        BfpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        `CannotLiquidateMargin()`,
        BfpMarketProxy
      );
    });

    it('should liquidate margin', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralPrice, collateralDepositAmount } =
        await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
        );
      // accrue some debt
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);
      await collateral.setPrice(wei(collateralPrice).mul(0.01).toBN());
      // Grab the collateral price so we can calculate keeper rewards correctly.
      const { collateralUsd } = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      // Set baseFeePerGas to 1 gwei to make the keeper rewards calculation easier.
      const baseFeePerGas = await setBaseFeePerGas(1, provider());
      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        provider()
      );
      // Calculate liq reward
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const {
        keeperProfitMarginPercent,
        keeperLiquidateMarginGasUnits,
        keeperProfitMarginUsd,
        maxKeeperFeeUsd,
      } = await BfpMarketProxy.getMarketConfiguration();
      const { liquidationRewardPercent } =
        await BfpMarketProxy.getMarketConfigurationById(marketId);
      const expectedCostLiq = wei(
        calcTransactionCostInUsd(baseFeePerGas, keeperLiquidateMarginGasUnits, ethPrice)
      );

      const liqFeeInUsd = Wei.max(
        expectedCostLiq.mul(wei(1).add(wei(keeperProfitMarginPercent))),
        expectedCostLiq.add(wei(keeperProfitMarginUsd))
      );
      const liqFeeWithRewardInUsd = liqFeeInUsd.add(
        wei(collateralUsd).mul(wei(liquidationRewardPercent))
      );

      const expectedLiqReward = Wei.min(liqFeeWithRewardInUsd, wei(maxKeeperFeeUsd));

      await assertEvent(
        receipt,
        `MarginLiquidated(${trader.accountId}, ${marketId}, ${expectedLiqReward.toBN()})`,
        BfpMarketProxy
      );

      const accountDigest = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(accountDigest.debtUsd);
      assertBn.isZero(accountDigest.collateralUsd);
    });

    it('should revert and not pay any keeper fees to an empty account', async () => {
      const { BfpMarketProxy, USD } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      await BfpMarketProxy['createAccount(uint128)'](0x1337);

      const balanceBefore = await USD.balanceOf(await keeper().getAddress());
      await assertRevert(
        BfpMarketProxy.connect(keeper()).liquidateMarginOnly(0x1337, marketId),
        `CannotLiquidateMargin()`,
        BfpMarketProxy
      );
      const balanceAfter = await USD.balanceOf(await keeper().getAddress());

      assertBn.equal(balanceAfter, balanceBefore);
    });
  });
});
