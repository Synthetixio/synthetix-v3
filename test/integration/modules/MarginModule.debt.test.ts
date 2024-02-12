import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { calcPnl } from '../../calculations';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  ADDRESS0,
  commitAndSettle,
  depositMargin,
  findEventSafe,
  getSusdCollateral,
  mintAndApprove,
  withExplicitEvmMine,
} from '../../helpers';

describe('MarginModule Debt', async () => {
  const bs = bootstrap(genBootstrap());
  const { collaterals, collateralsWithoutSusd, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('payDebt', () => {
    it('should revert when 0 amount', async () => {
      const { PerpMarketProxy } = systems();

      await assertRevert(PerpMarketProxy.payDebt(1, 2, 0), 'ZeroAmount');
    });

    it('should revert if account does not exists or missing permission', async () => {
      const { PerpMarketProxy } = systems();
      const invalidAccountId = genNumber(42069, 50000);
      await assertRevert(PerpMarketProxy.payDebt(invalidAccountId, 2, 1), `PermissionDenied("${invalidAccountId}"`);
    });

    it('should revert if market does not exists', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await depositMargin(bs, genTrader(bs));

      const invalidMarketId = genNumber(42069, 50000);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, invalidMarketId, 1),
        `MarketNotFound("${invalidMarketId}")`
      );
    });

    it('should revert when no debt', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId } = await depositMargin(bs, genTrader(bs));
      await assertRevert(PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, bn(100)), 'NoDebt');
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
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, ethers.constants.MaxUint256),
        'InsufficientAllowance'
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
      const sUSDBalance = await sUSD.contract.connect(trader.signer).balanceOf(await trader.signer.getAddress());
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

      await sUSD.contract.connect(trader.signer).approve(PerpMarketProxy.address, ethers.constants.MaxUint256);
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, closeOrderEvent.args.accountDebt),
        'InsufficientBalance'
      );
    });

    it('should remove debt and emit event for non usd collateral', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
      );
      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
      const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);
      // Price moves, causing a 10% loss.
      const newMarketOraclePrice1 = wei(openOrder.oraclePrice)
        .mul(openOrder.sizeDelta.gt(0) ? 0.9 : 1.1)
        .toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice1);

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
      const pnl = calcPnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
      const expectedChangeUsd = wei(pnl)
        .sub(fees)
        .add(closeOrderEvent?.args.accruedFunding)
        .sub(closeOrderEvent?.args.accruedUtilization);
      const { debt: debtFromAccountDigest } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
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
      await assertEvent(receipt, `DebtPaid(${debtFromAccountDigest}, 0, 0)`, PerpMarketProxy);

      const { debt: debtFromAccountDigestAfter } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

      assertBn.isZero(debtFromAccountDigestAfter);
    });

    it('should allow max uint when paying off debt', async () => {
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

      const { debt: debtBefore } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      assertBn.gt(debtBefore, bn(0));

      const sUSD = getSusdCollateral(collaterals());

      await mintAndApprove(bs, sUSD, debtBefore, trader.signer);
      await PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, ethers.constants.MaxUint256);

      const { debt: debtAfter } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
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
      const { debt: debtBefore } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
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
      const sUSDBalanceBefore = await sUSDcollateral.contract.balanceOf(await trader.signer.getAddress());

      // Make sure sUSD balance is less than debt
      assertBn.lt(sUSDBalanceBefore, debtBefore);

      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(trader.signer).payDebt(trader.accountId, marketId, ethers.constants.MaxUint256),
        provider()
      );

      const debtPaidEvent = findEventSafe(receipt, 'DebtPaid', PerpMarketProxy);
      const { debt: debtAfter } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
      // Assert events
      assertBn.equal(debtPaidEvent.args.amountPaidOff, debtBefore);
      assertBn.equal(debtPaidEvent.args.amountFromCollateral, amountToBePaidOffByCollateral);
      assertBn.isZero(debtPaidEvent.args.newDebt);

      const sUSDBalanceAfter = await sUSDcollateral.contract.balanceOf(await trader.signer.getAddress());

      // Assert debt and sUSD balance
      assertBn.isZero(debtAfter);
      assertBn.equal(sUSDBalanceAfter, extraSUSDBalance);
    });
  });
});
