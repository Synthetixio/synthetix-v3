import { bn, bootstrapMarkets } from '../bootstrap';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { calculateFillPrice, computeFees, depositCollateral, openPosition } from '../helpers';
import Wei, { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';

const accountId = 4;

const synthMarketsConfig = [
  {
    name: 'eth',
    token: 'snxETH',
    buyPrice: bn(2_000),
    sellPrice: bn(2_000),
  },
];

const orderFees = {
  makerFee: wei(0.0003), // 3bps
  takerFee: wei(0.0008), // 8bps
};

const ethPerpsMarketId = bn(26);
const sUSDSynthId = 0;

describe('Account - payDebt()', () => {
  const { systems, provider, perpsMarkets, trader1, synthMarkets, superMarketId } =
    bootstrapMarkets({
      synthMarkets: synthMarketsConfig,
      perpsMarkets: [
        {
          requestedMarketId: ethPerpsMarketId,
          name: 'Ether',
          token: 'ETH',
          price: bn(2000),
          fundingParams: { skewScale: bn(1000), maxFundingVelocity: bn(0) },
          orderFees: {
            makerFee: orderFees.makerFee.toBN(),
            takerFee: orderFees.takerFee.toBN(),
          },
          liquidationParams: {
            initialMarginFraction: bn(2),
            minimumInitialMarginRatio: bn(0.01),
            maintenanceMarginScalar: bn(0.5),
            maxLiquidationLimitAccumulationMultiplier: bn(1),
            liquidationRewardRatio: bn(0.05),
            maxSecondsInLiquidationWindow: ethers.BigNumber.from(10),
            minimumPositionMargin: bn(500),
          },
        },
      ],
      traderAccountIds: [accountId],
      liquidationGuards: {
        minLiquidationReward: bn(0),
        minKeeperProfitRatioD18: bn(0),
        maxLiquidationReward: bn(10_000),
        maxKeeperScalingRatioD18: bn(1),
      },
    });

  before('deposit some snxETH', async () => {
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => accountId,
      collaterals: [
        {
          synthMarket: () => synthMarkets()[0],
          snxUSDAmount: () => bn(240_000),
        },
      ],
    });
  });

  const openAndClosePosition = (size: Wei, startingPrice: Wei, endingPrice: Wei) => {
    const initialFillPrice = calculateFillPrice(wei(0), wei(1000), size, startingPrice);
    const finalFillPrice = calculateFillPrice(size, wei(1000), size.mul(-1), endingPrice);

    const openOrderFee = computeFees(wei(0), wei(50), initialFillPrice, orderFees);
    const closeOrderFee = computeFees(wei(50), wei(-50), finalFillPrice, orderFees);

    before(`open position size ${size.toString()}`, async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(startingPrice.toBN());

      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethPerpsMarketId,
        sizeDelta: size.toBN(),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: startingPrice.toBN(),
      });
    });

    before('set ending price', async () => {
      await perpsMarkets()[0].aggregator().mockSetCurrentPrice(endingPrice.toBN());
    });

    before('close position', async () => {
      await openPosition({
        systems,
        provider,
        trader: trader1(),
        accountId,
        keeper: trader1(),
        marketId: ethPerpsMarketId,
        sizeDelta: size.mul(-1).toBN(),
        settlementStrategyId: perpsMarkets()[0].strategyId(),
        price: endingPrice.toBN(),
      });
    });

    return {
      openOrderFee,
      closeOrderFee,
      totalFees: openOrderFee.totalFees.add(closeOrderFee.totalFees),
      pnl: finalFillPrice.sub(initialFillPrice).mul(size),
    };
  };

  describe('when no account exists', () => {
    it('reverts', async () => {
      await assertRevert(systems().PerpsMarket.payDebt(25, bn(200)), 'AccountNotFound');
    });

    it('reverts', async () => {
      await assertRevert(systems().PerpsMarket.rebalanceDebt(25, bn(200)), 'AccountNotFound');
    });
  });

  describe('when no debt exists', () => {
    it('reverts', async () => {
      await assertRevert(systems().PerpsMarket.payDebt(accountId, bn(200)), 'NonexistentDebt');
    });

    it('reverts', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).rebalanceDebt(accountId, bn(200)),
        'NonexistentDebt'
      );
    });
  });

  describe('with debt', () => {
    let accruedDebt: Wei;
    const { pnl: expectedPnl, totalFees } = openAndClosePosition(wei(50), wei(2000), wei(1500));

    it('accrues correct amount of debt', async () => {
      accruedDebt = expectedPnl.sub(totalFees).abs();
      assertBn.equal(accruedDebt.abs().toBN(), await systems().PerpsMarket.debt(accountId));
    });

    describe('pay off some debt', () => {
      let traderUSDBalance: Wei, reportedDebt: Wei;
      const payoffAmount = wei(10_000);
      let tx: ethers.providers.TransactionResponse;
      before(async () => {
        reportedDebt = wei(await systems().PerpsMarket.reportedDebt(superMarketId()));
        traderUSDBalance = wei(await systems().USD.balanceOf(await trader1().getAddress()));
        tx = await systems().PerpsMarket.connect(trader1()).payDebt(accountId, payoffAmount.toBN());
      });

      it('has correct debt', async () => {
        accruedDebt = accruedDebt.sub(payoffAmount);
        assertBn.equal(await systems().PerpsMarket.debt(accountId), accruedDebt.toBN());
      });

      it('has correct USD balance', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1().getAddress()),
          traderUSDBalance.sub(payoffAmount).toBN()
        );
      });

      it('has correct reported debt', async () => {
        assertBn.equal(
          await systems().PerpsMarket.reportedDebt(superMarketId()),
          reportedDebt.add(payoffAmount).toBN()
        );
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `DebtPaid(${accountId}, ${bn(10_000)}, "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });
    });

    describe('attempt to pay off more than debt', () => {
      let traderUSDBalance: Wei, withdrawableMargin: Wei, reportedDebt: Wei;

      before(async () => {
        reportedDebt = wei(await systems().PerpsMarket.reportedDebt(superMarketId()));
        traderUSDBalance = wei(await systems().USD.balanceOf(await trader1().getAddress()));
        withdrawableMargin = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));
        await systems()
          .PerpsMarket.connect(trader1())
          .payDebt(accountId, accruedDebt.add(wei(10_000)).toBN());
      });

      it('zeroes out the debt', async () => {
        assertBn.equal(await systems().PerpsMarket.debt(accountId), 0);
      });

      it('has correct USD balance', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1().getAddress()),
          traderUSDBalance.sub(accruedDebt).toBN()
        );
      });

      it('has correct reported debt', async () => {
        assertBn.equal(
          await systems().PerpsMarket.reportedDebt(superMarketId()),
          reportedDebt.add(accruedDebt).toBN()
        );
      });

      it('has correct withdrawable margin', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(superMarketId()),
          withdrawableMargin.add(accruedDebt).toBN()
        );
      });
    });
  });

  describe('using rebalanceDebt', () => {
    let accruedDebt: Wei;
    const { pnl: expectedPnl, totalFees } = openAndClosePosition(wei(50), wei(2000), wei(1500));

    it('accrues correct amount of debt', async () => {
      accruedDebt = expectedPnl.sub(totalFees).abs();
      assertBn.equal(accruedDebt.abs().toBN(), await systems().PerpsMarket.debt(accountId));
    });

    it('revert with insufficient credit for rebalance', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(trader1()).rebalanceDebt(accountId, bn(200)),
        'InsufficientCreditForDebtRebalance'
      );
    });

    describe('pay off some debt', () => {
      let traderUSDBalance: Wei, reportedDebt: Wei;
      const payoffAmount = wei(10_000);
      let tx: ethers.providers.TransactionResponse;
      before(async () => {
        reportedDebt = wei(await systems().PerpsMarket.reportedDebt(superMarketId()));
        traderUSDBalance = wei(await systems().USD.balanceOf(await trader1().getAddress()));

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, sUSDSynthId, wei(20_000).toBN());

        tx = await systems()
          .PerpsMarket.connect(trader1())
          .rebalanceDebt(accountId, payoffAmount.toBN());
      });

      it('has correct debt', async () => {
        accruedDebt = accruedDebt.sub(payoffAmount);
        assertBn.equal(await systems().PerpsMarket.debt(accountId), accruedDebt.toBN());
      });

      it('has correct USD balance', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1().getAddress()),
          traderUSDBalance.sub(payoffAmount).toBN()
        );
      });

      it('has correct reported debt', async () => {
        assertBn.equal(
          await systems().PerpsMarket.reportedDebt(superMarketId()),
          reportedDebt.add(payoffAmount).toBN()
        );
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `DebtPaid(${accountId}, ${bn(10_000)}, "${await trader1().getAddress()}")`,
          systems().PerpsMarket
        );
      });
    });

    describe('attempt to pay off more than debt', () => {
      let traderUSDBalance: Wei, withdrawableMargin: Wei, reportedDebt: Wei;

      before(async () => {
        reportedDebt = wei(await systems().PerpsMarket.reportedDebt(superMarketId()));
        traderUSDBalance = wei(await systems().USD.balanceOf(await trader1().getAddress()));
        withdrawableMargin = wei(await systems().Core.getWithdrawableMarketUsd(superMarketId()));

        await systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountId, sUSDSynthId, wei(10_000).toBN());

        await systems()
          .PerpsMarket.connect(trader1())
          .rebalanceDebt(accountId, accruedDebt.add(wei(10_000)).toBN());
      });

      it('zeroes out the debt', async () => {
        assertBn.equal(await systems().PerpsMarket.debt(accountId), 0);
      });

      it('has correct USD balance', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1().getAddress()),
          traderUSDBalance.sub(accruedDebt).toBN()
        );
      });

      it('has correct reported debt', async () => {
        assertBn.equal(
          await systems().PerpsMarket.reportedDebt(superMarketId()),
          reportedDebt.add(accruedDebt).toBN()
        );
      });

      it('has correct withdrawable margin', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(superMarketId()),
          withdrawableMargin.add(accruedDebt).toBN()
        );
      });
    });
  });
});
