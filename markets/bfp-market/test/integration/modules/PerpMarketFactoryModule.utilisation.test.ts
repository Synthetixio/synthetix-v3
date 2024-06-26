import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  SECONDS_ONE_DAY,
  commitAndSettle,
  depositMargin,
  fastForwardBySec,
  findEventSafe,
  setMarketConfiguration,
  setMarketConfigurationById,
  withExplicitEvmMine,
} from '../../helpers';
import { calcUtilization, calcUtilizationRate } from '../../calculations';

describe('PerpMarketFactoryModule Utilization', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, systems, restore, provider, pool, owner, collateralsWithoutSusd } = bs;

  beforeEach(restore);

  describe('getMarketDigest.utilizationRate', () => {
    it('should be 0 when no position open', async () => {
      const { BfpMarketProxy } = systems();
      const market = genOneOf(markets());
      const marketDigest = await BfpMarketProxy.getMarketDigest(market.marketId());
      assertBn.equal(marketDigest.utilizationRate, bn(0));
    });

    it('should handle utilization config set to 0', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const d1 = await BfpMarketProxy.getMarketDigest(market.marketId());

      // Should not be 0 as our settlement has recomputed utilization
      assertBn.notEqual(d1.utilizationRate, bn(0));

      // Set config values to 0
      await setMarketConfiguration(bs, {
        utilizationBreakpointPercent: 0,
        lowUtilizationSlopePercent: 0,
        highUtilizationSlopePercent: 0,
      });

      // Should not be 0 as utilization has not been recomputed yet.
      const marketDigest1 = await BfpMarketProxy.getMarketDigest(market.marketId());
      assertBn.notEqual(marketDigest1.utilizationRate, bn(0));

      await BfpMarketProxy.recomputeUtilization(marketId);
      const d2 = await BfpMarketProxy.getMarketDigest(market.marketId());

      // We now expect utilization to be 0
      assertBn.equal(d2.utilizationRate, bn(0));
    });

    it('should not revert when collateral utilization is exactly at 100%', async () => {
      const { BfpMarketProxy, Core } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();
      const collateral = genOneOf(collateralsWithoutSusd());

      // Remove fees incurred on the trade.
      await setMarketConfigurationById(bs, marketId, {
        makerFee: bn(0),
        takerFee: bn(0),
      });
      await setMarketConfiguration(bs, {
        minKeeperFeeUsd: bn(0),
        maxKeeperFeeUsd: bn(0),
      });

      const withdrawable = await Core.getWithdrawableMarketUsd(marketId);
      const { totalCollateralValueUsd } = await BfpMarketProxy.getMarketDigest(marketId);
      const delegatedAmountUsd = wei(withdrawable).sub(totalCollateralValueUsd);

      const { answer: marketPrice } = await market.aggregator().latestRoundData();

      // Increase OI to be slighly above max delegated amount for this test to work.
      await setMarketConfigurationById(bs, marketId, {
        maxMarketSize: delegatedAmountUsd.div(marketPrice).add(10).toBN(),
      });

      // Perform trade where the collateral to deposit is equal exactly to the delegatedAmountUsd.
      const { trader, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarket: market,
          desiredMarginUsdDepositAmount: delegatedAmountUsd.toNumber(),
          desiredCollateral: collateral,
        })
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
        desiredKeeperFeeBufferUsd: 0,
      });
      await commitAndSettle(bs, marketId, trader, order);

      // Credit `delegatedAmountUsd` so that withdrawableUsd is exactly eq deposited collateral.
      await BfpMarketProxy.connect(owner()).__test_creditAccountMarginProfitUsd(
        trader.accountId,
        marketId,
        delegatedAmountUsd.toBN()
      );

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.recomputeUtilization(marketId),
        provider()
      );
      const { utilizationRate } = findEventSafe(
        receipt,
        'UtilizationRecomputed',
        BfpMarketProxy
      ).args;

      assertBn.notEqual(utilizationRate, 0);

      const withdrawable2 = await Core.getWithdrawableMarketUsd(marketId);
      const { totalCollateralValueUsd: totalCollateralValueUsd2 } =
        await BfpMarketProxy.getMarketDigest(marketId);

      assertBn.equal(withdrawable2, totalCollateralValueUsd2);
    });

    it('should have utilization capped to one when delegated collateral < lockedCollateral', async () => {
      const { BfpMarketProxy, Core } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();

      // Change CORE staking/delegation to the minimum amount.
      const { stakerAccountId, id: poolId, collateral: stakedCollateral, staker } = pool();
      const { minDelegationD18 } = await Core.getCollateralConfiguration(
        stakedCollateral().address
      );
      const stakedCollateralAddress = stakedCollateral().address;
      await Core.connect(staker()).delegateCollateral(
        stakerAccountId,
        poolId,
        stakedCollateralAddress,
        minDelegationD18,
        bn(1)
      );

      // Create one trade that will win more than the delegated collateral.
      const { collateral, collateralDepositAmount, trader } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarket: market })
      );

      // Create a long position
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Price 10x, causing large profits for the trader.
      const newMarketOraclePrice = wei(order1.oraclePrice).mul(10).toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      // Get delegated usd amount.
      const withdrawable = await Core.getWithdrawableMarketUsd(market.marketId());
      const { totalCollateralValueUsd, size, oraclePrice } = await BfpMarketProxy.getMarketDigest(
        market.marketId()
      );
      const { minCreditPercent } = await BfpMarketProxy.getMarketConfigurationById(
        market.marketId()
      );

      const delegatedAmountUsd = wei(withdrawable).sub(totalCollateralValueUsd);
      const lockedCollateralUsd = wei(size).mul(oraclePrice).mul(minCreditPercent);
      const utilizationWithoutCap = delegatedAmountUsd.div(lockedCollateralUsd);
      // Assert that the uncapped utilization is above 1.
      assertBn.gt(utilizationWithoutCap.toBN(), 1);

      const { receipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.recomputeUtilization(marketId),
        provider()
      );
      const recomputeUtilizationEvent = findEventSafe(
        receipt,
        'UtilizationRecomputed',
        BfpMarketProxy
      );

      // Calculate the expected utilization rate, assuming utilization was capped at 1.
      const expectedUtilization = 1;
      const expectedUtilizationRate = await calcUtilizationRate(bs, wei(expectedUtilization));

      assertBn.equal(
        expectedUtilizationRate.toBN(),
        recomputeUtilizationEvent.args.utilizationRate
      );
    });

    it('should support collateral utilization above 100% due to delegatedCollateral being negative', async () => {
      const { BfpMarketProxy, Core } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();

      // Change staking to the minimum about
      const { stakerAccountId, id: poolId, collateral: stakedCollateral, staker } = pool();
      const { minDelegationD18 } = await Core.getCollateralConfiguration(
        stakedCollateral().address
      );
      const stakedCollateralAddress = stakedCollateral().address;
      await Core.connect(staker()).delegateCollateral(
        stakerAccountId,
        poolId,
        stakedCollateralAddress,
        minDelegationD18,
        bn(1)
      );

      // Create one trade that will win more than the delegated collateral
      const { trader, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarket: market })
      );

      // Create a long position
      const order1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSide: 1,
      });
      await commitAndSettle(bs, marketId, trader, order1);

      // Price 10x, causing large profits for the trader
      const newMarketOraclePrice = wei(order1.oraclePrice).mul(10).toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      const decreaseOrder1 = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: wei(order1.sizeDelta).mul(-1).mul(0.9).toBN(),
      });

      await commitAndSettle(bs, marketId, trader, decreaseOrder1);

      // (1) The market is underwater
      // (2) trader1 has some sUSD allocated to his collateral
      // (3) but trader1 wouldn't be able to withdraw until more stakers come in/or LPs get liquidated
      const { receipt: recomputeReceipt1 } = await withExplicitEvmMine(
        () => BfpMarketProxy.recomputeUtilization(marketId),
        provider()
      );
      const recomputeUtilizationEvent1 = findEventSafe(
        recomputeReceipt1,
        'UtilizationRecomputed',
        BfpMarketProxy
      );

      // We expect max utilization rate, which is based on the slope configs.
      const expectedUtilization = 1;
      const expectedUtilizationRate = await calcUtilizationRate(bs, wei(expectedUtilization));

      assertBn.equal(
        expectedUtilizationRate.toBN(),
        recomputeUtilizationEvent1.args.utilizationRate
      );

      const { size } = await BfpMarketProxy.getPositionDigest(trader.accountId, marketId);
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: size.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      // Now there are no more open positions in the market, we expect the utilization to be 0.
      const { receipt: recomputeReceipt2 } = await withExplicitEvmMine(
        () => BfpMarketProxy.recomputeUtilization(marketId),
        provider()
      );
      const recomputeUtilizationEvent2 = findEventSafe(
        recomputeReceipt2,
        'UtilizationRecomputed',
        BfpMarketProxy
      );
      assertBn.isZero(recomputeUtilizationEvent2.args.utilizationRate);
    });

    enum UtilizationMode {
      LOW = 'LOW',
      HIGH = 'HIGH',
    }

    forEach([UtilizationMode.LOW, UtilizationMode.HIGH]).it(
      'should return current rate when utilization is %s',
      async (mode) => {
        const { BfpMarketProxy, Core } = systems();

        const globalMarketConfig = await BfpMarketProxy.getMarketConfiguration();
        const utilizationBreakpointPercent = wei(globalMarketConfig.utilizationBreakpointPercent);
        const lowUtilizationSlopePercent = wei(globalMarketConfig.lowUtilizationSlopePercent);
        const highUtilizationSlopePercent = wei(globalMarketConfig.highUtilizationSlopePercent);

        const market = genOneOf(markets());
        const marketConfig = await BfpMarketProxy.getMarketConfigurationById(market.marketId());

        // Create random utilization rate
        const breakPointNumber = utilizationBreakpointPercent.mul(100).toNumber();
        const utilization =
          mode === UtilizationMode.LOW
            ? Math.floor(genNumber(1, breakPointNumber))
            : Math.floor(genNumber(breakPointNumber, 100));
        const targetUtilizationPercent = wei(utilization).div(100);

        // Get delegated usd amount
        const withdrawable = await Core.getWithdrawableMarketUsd(market.marketId());
        const { totalCollateralValueUsd } = await BfpMarketProxy.getMarketDigest(market.marketId());
        const delegatedAmountUsd = wei(withdrawable).sub(totalCollateralValueUsd);

        const leverage = genNumber(1, 5);

        // Calculate target notional amount based on the utilization we're targeting
        const targetNotional = delegatedAmountUsd
          .mul(targetUtilizationPercent)
          .mul(marketConfig.minCreditPercent);

        const { answer: marketPrice } = await market.aggregator().latestRoundData();

        // Make sure OI is large enough to support the target notional
        await setMarketConfigurationById(bs, market.marketId(), {
          maxMarketSize: targetNotional.div(marketPrice).add(10).toBN(),
        });

        // Do the trade
        const depositAmountUsd = wei(targetNotional).div(leverage);
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredMarginUsdDepositAmount: depositAmountUsd.toNumber(),
          })
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: leverage,
        });
        await commitAndSettle(bs, marketId, trader, order);

        // assert the utilization rate
        const marketDigest = await BfpMarketProxy.getMarketDigest(market.marketId());
        if (mode === UtilizationMode.LOW) {
          const expectedRate = wei(lowUtilizationSlopePercent)
            .mul(targetUtilizationPercent)
            .mul(100);
          assertBn.near(expectedRate.toBN(), marketDigest.utilizationRate, bn(0.0001));
        } else {
          const lowPart = lowUtilizationSlopePercent.mul(utilizationBreakpointPercent).mul(100);
          const highPart = highUtilizationSlopePercent
            .mul(wei(targetUtilizationPercent).sub(utilizationBreakpointPercent))
            .mul(100);
          const expectedRate = lowPart.add(highPart);

          assertBn.near(expectedRate.toBN(), marketDigest.utilizationRate, bn(0.0001));
        }
      }
    );
  });
  describe('getUtilizationDigest', async () => {
    it('should return utilization data', async () => {
      const { BfpMarketProxy, Core } = systems();
      const market = genOneOf(markets());

      const { marketId, trader, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarket: market })
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      const { settlementTime, receipt } = await commitAndSettle(bs, marketId, trader, order);

      const utilizationEvent = findEventSafe(receipt, 'UtilizationRecomputed', BfpMarketProxy);
      const computedUtilizationRate = utilizationEvent.args.utilizationRate;
      const expectedUtilization1 = await calcUtilization(bs, marketId);
      const expectedUtilizationRate1 = await calcUtilizationRate(bs, expectedUtilization1);
      const utilizationDigest1 = await BfpMarketProxy.getUtilizationDigest(marketId);

      assertBn.equal(utilizationDigest1.utilization, expectedUtilization1.toBN());
      assertBn.equal(utilizationDigest1.currentUtilizationRate, expectedUtilizationRate1.toBN());
      assertBn.equal(utilizationDigest1.lastComputedTimestamp, settlementTime + 1);
      assertBn.equal(utilizationDigest1.lastComputedUtilizationRate, computedUtilizationRate);

      const {
        stakerAccountId,
        id: poolId,
        collateral: stakedCollateral,
        staker,
        stakedAmount,
      } = pool();

      // Some time passes
      await fastForwardBySec(provider(), genNumber(1, SECONDS_ONE_DAY));
      // Decrease amount of staked collateral on the core side.
      const stakedCollateralAddress = stakedCollateral().address;
      await withExplicitEvmMine(
        () =>
          Core.connect(staker()).delegateCollateral(
            stakerAccountId,
            poolId,
            stakedCollateralAddress,
            wei(stakedAmount).mul(0.9).toBN(),
            bn(1)
          ),
        provider()
      );

      const utilizationDigest2 = await BfpMarketProxy.getUtilizationDigest(marketId);
      const expectedUtilization2 = await calcUtilization(bs, marketId);
      const expectedUtilizationRate2 = await calcUtilizationRate(bs, expectedUtilization2);

      // We now expect `utilization` and `currentUtilizationRate` to have increased, as there's less capital backing the market.
      assertBn.gt(utilizationDigest2.utilization, utilizationDigest1.utilization);
      assertBn.gt(
        utilizationDigest2.currentUtilizationRate,
        utilizationDigest1.currentUtilizationRate
      );
      // `utilization` and `currentUtilizationRate` should reflect the changes.
      assertBn.equal(utilizationDigest2.utilization, expectedUtilization2.toBN());
      assertBn.equal(utilizationDigest2.currentUtilizationRate, expectedUtilizationRate2.toBN());

      // We expect `lastComputedTimestamp` and `lastComputedUtilizationRate` to remain the same, as no one has called recomputeUtilization.
      assertBn.equal(
        utilizationDigest2.lastComputedTimestamp,
        utilizationDigest1.lastComputedTimestamp
      );
      assertBn.equal(
        utilizationDigest2.lastComputedUtilizationRate,
        utilizationDigest1.lastComputedUtilizationRate
      );

      // Recompute utilization
      const { receipt: recomputeReceipt } = await withExplicitEvmMine(
        () => BfpMarketProxy.recomputeUtilization(marketId),
        provider()
      );

      const utilizationEvent2 = findEventSafe(
        recomputeReceipt,
        'UtilizationRecomputed',
        BfpMarketProxy
      );
      const { timestamp } = await provider().getBlock(receipt.blockNumber);

      const utilizationDigest3 = await BfpMarketProxy.getUtilizationDigest(marketId);

      // Utilization and utilization rate should be the same as before recomputeUtilization.
      assertBn.equal(utilizationDigest3.utilization, utilizationDigest2.utilization);
      assertBn.equal(
        utilizationDigest3.currentUtilizationRate,
        utilizationDigest2.currentUtilizationRate
      );

      // `lastComputedTimestamp` should have the same value as the timestamp of the recomputeUtilization call.
      assertBn.equal(utilizationDigest2.lastComputedTimestamp, timestamp);
      // `lastComputedUtilizationRate` should be larger than before recompute.
      assertBn.gt(
        utilizationDigest3.lastComputedUtilizationRate,
        utilizationDigest2.lastComputedUtilizationRate
      );
      // It should also match the rate from the event.
      assertBn.equal(
        utilizationDigest3.lastComputedUtilizationRate,
        utilizationEvent2.args.utilizationRate
      );
    });
  });
});
