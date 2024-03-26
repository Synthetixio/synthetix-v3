import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import Wei, { wei } from '@synthetixio/wei';
import { bootstrap } from '../../bootstrap';
import { calcPricePnl, calcTransactionCostInUsd } from '../../calculations';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
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
  withExplicitEvmMine,
} from '../../helpers';

describe('MarginModule Debt', async () => {
  const bs = bootstrap(genBootstrap());
  const { collaterals, collateralsWithoutSusd, systems, provider, restore, keeper } = bs;

  beforeEach(restore);

  describe('payDebt', () => {
    it('should revert when 0 amount', async () => {
      const { PerpMarketProxy } = systems();

      await assertRevert(PerpMarketProxy.payDebt(1, 2, 0), 'ZeroAmount', PerpMarketProxy);
    });

    it('should revert if account does not exists or missing permission', async () => {
      const { PerpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.payDebt(invalidAccountId, 2, 1),
        `PermissionDenied("${invalidAccountId}"`,
        PerpMarketProxy
      );
    });

    it('should revert if market does not exists', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, invalidMarketId, 1),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when no debt', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, bn(100)),
        'NoDebt()',
        PerpMarketProxy
      );
    });

    it('should revert when sUSD is not approved', async () => {
      const { PerpMarketProxy } = systems();

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
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, MaxUint128),
        'InsufficientAllowance',
        PerpMarketProxy
      );
    });

    it('should revert not enough balance', async () => {
      const { PerpMarketProxy } = systems();

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
      const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy);

      // Make sure we have some debt
      assertBn.gt(closeOrderEvent.args.accountDebt, 0);

      await sUSD.contract.connect(trader.signer).approve(PerpMarketProxy.address, MaxUint128);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).payDebt(
          trader.accountId,
          marketId,
          closeOrderEvent.args.accountDebt
        ),
        'InsufficientBalance',
        PerpMarketProxy
      );
    });

    it('should remove debt and emit event for non usd collateral', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
          desiredMarginUsdDepositAmount: 10_000,
        })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

      await fastForwardBySec(provider(), SECONDS_ONE_DAY);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

      const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', PerpMarketProxy);
      const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy);

      const fees = wei(openOrderEvent?.args.orderFee)
        .add(openOrderEvent?.args.keeperFee)
        .add(closeOrderEvent?.args.orderFee)
        .add(closeOrderEvent?.args.keeperFee);

      // Pnl expected to be close to 0 since not oracle price change
      const pnl = calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
      const expectedChangeUsd = wei(pnl)
        .sub(fees)
        .add(closeOrderEvent.args.accruedFunding)
        .sub(closeOrderEvent.args.accruedUtilization);
      const { debtUsd: debtFromAccountDigest } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      // Make sure we had from funding and utilization accrued.
      assertBn.notEqual(closeOrderEvent.args.accruedFunding, 0);
      assertBn.notEqual(closeOrderEvent.args.accruedUtilization, 0);
      assertBn.equal(debtFromAccountDigest, closeOrderEvent.args.accountDebt);
      // Debt from digest and order settled event should be the same
      assertBn.equal(debtFromAccountDigest, closeOrderEvent.args.accountDebt);

      // The account's debt should account for all the fees and pnl.
      assertBn.equal(expectedChangeUsd.abs().toBN(), closeOrderEvent.args.accountDebt);

      const sUSD = getSusdCollateral(collaterals());
      await mintAndApprove(bs, sUSD, closeOrderEvent.args.accountDebt, trader.signer);

      const tx = await PerpMarketProxy.connect(trader.signer).payDebt(
        trader.accountId,
        marketId,
        closeOrderEvent.args.accountDebt
      );

      const receipt = await tx.wait();
      await assertEvent(
        receipt,
        `DebtPaid(${trader.accountId}, ${marketId}, ${debtFromAccountDigest}, 0, 0)`,
        PerpMarketProxy
      );

      const { debtUsd: debtFromAccountDigestAfter } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );

      assertBn.isZero(debtFromAccountDigestAfter);
    });

    it('should allow max sending a bigger amount than the debt', async () => {
      const { PerpMarketProxy } = systems();

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

      const { debtUsd: debtBefore } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.gt(debtBefore, bn(0));

      const sUSD = getSusdCollateral(collaterals());

      await mintAndApprove(bs, sUSD, debtBefore, trader.signer);
      await PerpMarketProxy.connect(trader.signer).payDebt(
        trader.accountId,
        marketId,
        debtBefore.mul(2)
      );

      const { debtUsd: debtAfter } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );
      assertBn.isZero(debtAfter);
    });
    it('should remove debt using sUSD collateral when user have some', async () => {
      const { PerpMarketProxy } = systems();

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
      const { debtUsd: debtBefore } = await PerpMarketProxy.getAccountDigest(
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
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            sUSDcollateral.synthMarketId(),
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
        () =>
          PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, MaxUint128),
        provider()
      );

      const debtPaidEvent = findEventSafe(receipt, 'DebtPaid', PerpMarketProxy);
      const { debtUsd: debtAfter } = await PerpMarketProxy.getAccountDigest(
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
      const { PerpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).isMarginLiquidatable(
          trader.accountId,
          invalidMarketId
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should revert on invalid account id', async () => {
      const { PerpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.isMarginLiquidatable(invalidAccountId, 2),
        `AccountNotFound("${invalidAccountId}"`,
        PerpMarketProxy
      );
    });

    it('should return false if we have a position', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, openOrder);

      const isMarginLiquidatable = await PerpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatable, false);
    });

    it('should return false when account has no collateral', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await genTrader(bs);
      const isMarginLiquidatable = await PerpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatable, false);
    });

    it('should return true when margin can be liquidated', async () => {
      const { PerpMarketProxy } = systems();

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

      const isMarginLiquidatableBefore = await PerpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );
      assert.equal(isMarginLiquidatableBefore, false);

      await collateral.setPrice(wei(collateralPrice).mul(0.01).toBN());

      const isMarginLiquidatableAfter = await PerpMarketProxy.isMarginLiquidatable(
        trader.accountId,
        marketId
      );

      assert.equal(isMarginLiquidatableAfter, true);
    });
  });

  describe('liquidateMarginOnly', () => {
    it('should revert on invalid market id', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).liquidateMarginOnly(
          trader.accountId,
          invalidMarketId
        ),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should revert on invalid account id', async () => {
      const { PerpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.liquidateMarginOnly(invalidAccountId, 2),
        `AccountNotFound("${invalidAccountId}"`,
        PerpMarketProxy
      );
    });

    it('should revert when there is an open a position', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
      });
      await commitAndSettle(bs, marketId, trader, openOrder);
      const posDigest = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

      assertBn.notEqual(posDigest.size, 0);

      await assertRevert(
        PerpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        `CannotLiquidateMargin()`,
        PerpMarketProxy
      );
    });

    it('should revert if margin cant be liquidated', async () => {
      const { PerpMarketProxy } = systems();

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
        PerpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        `CannotLiquidateMargin()`,
        PerpMarketProxy
      );
    });

    it('should liquidate margin', async () => {
      const { PerpMarketProxy } = systems();

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
      const { collateralUsd } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      // Set baseFeePerGas to 1 gwei to make the keeper rewards calculation easier.
      const baseFeePerGas = await setBaseFeePerGas(1, provider());
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.liquidateMarginOnly(trader.accountId, marketId),
        provider()
      );
      // Calculate liq reward
      const { answer: ethPrice } = await bs.ethOracleNode().agg.latestRoundData();
      const {
        keeperProfitMarginPercent,
        keeperLiquidateMarginGasUnits,
        keeperProfitMarginUsd,
        maxKeeperFeeUsd,
      } = await PerpMarketProxy.getMarketConfiguration();
      const { liquidationRewardPercent } =
        await PerpMarketProxy.getMarketConfigurationById(marketId);
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
        PerpMarketProxy
      );

      const accountDigest = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.isZero(accountDigest.debtUsd);
      assertBn.isZero(accountDigest.collateralUsd);
    });

    it('should revert and not pay any keeper fees to an empty account', async () => {
      const { PerpMarketProxy, USD } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      await PerpMarketProxy['createAccount(uint128)'](0x1337);

      const balanceBefore = await USD.balanceOf(await keeper().getAddress());
      await assertRevert(
        PerpMarketProxy.connect(keeper()).liquidateMarginOnly(0x1337, marketId),
        `CannotLiquidateMargin()`,
        PerpMarketProxy
      );
      const balanceAfter = await USD.balanceOf(await keeper().getAddress());

      assertBn.equal(balanceAfter, balanceBefore);
    });
  });
});
