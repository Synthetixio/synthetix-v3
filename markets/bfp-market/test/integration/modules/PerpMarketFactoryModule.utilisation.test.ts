import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { shuffle } from 'lodash';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genOneOf,
  genOrder,
  genTrader,
  toRoundRobinGenerators,
} from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  findEventSafe,
  setMarketConfiguration,
  setMarketConfigurationById,
  withExplicitEvmMine,
} from '../../helpers';

describe('PerpMarketFactoryModule Utilization', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, systems, restore, provider, pool, traders, owner, collateralsWithoutSusd } = bs;

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

    it('should support collateral utilization above 100%', async () => {
      const { BfpMarketProxy, Core } = systems();

      const market = genOneOf(markets());
      const marketId = market.marketId();

      const globalMarketConfig = await BfpMarketProxy.getMarketConfiguration();
      const utilizationBreakpointPercent = wei(globalMarketConfig.utilizationBreakpointPercent);
      const lowUtilizationSlopePercent = wei(globalMarketConfig.lowUtilizationSlopePercent);
      const highUtilizationSlopePercent = wei(globalMarketConfig.highUtilizationSlopePercent);

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
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
      const trader1 = tradersGenerator.next().value;
      const trader2 = tradersGenerator.next().value;

      // Create one trade that will win more than the delegated collateral
      const { collateral: collateral1, collateralDepositAmount: collateralDepositAmount1 } =
        await depositMargin(bs, genTrader(bs, { desiredMarket: market, desiredTrader: trader1 }));

      // Create a long position
      const order1 = await genOrder(bs, market, collateral1, collateralDepositAmount1, {
        desiredSide: 1,
      });
      await commitAndSettle(bs, marketId, trader1, order1);

      // Price 10x, causing large profits for the trader
      const newMarketOraclePrice = wei(order1.oraclePrice).mul(10).toBN();
      await market.aggregator().mockSetCurrentPrice(newMarketOraclePrice);
      const closeOrder1 = await genOrder(bs, market, collateral1, collateralDepositAmount1, {
        desiredSize: order1.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader1, closeOrder1);

      // Create a new position with a different trader. This trader will will not incur and profits or losses.
      const { collateral: collateral2, collateralDepositAmount: collateralDepositAmount2 } =
        await depositMargin(bs, genTrader(bs, { desiredMarket: market, desiredTrader: trader2 }));
      const order2 = await genOrder(bs, market, collateral2, collateralDepositAmount2);
      await commitAndSettle(bs, marketId, trader2, order2);

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
      const lowPart = lowUtilizationSlopePercent.mul(utilizationBreakpointPercent).mul(100);
      const highPart = highUtilizationSlopePercent
        .mul(wei(expectedUtilization).sub(utilizationBreakpointPercent))
        .mul(100);
      const expectedUtilizationRate = lowPart.add(highPart).toBN();

      assertBn.equal(expectedUtilizationRate, recomputeUtilizationEvent1.args.utilizationRate);

      const closeOrder2 = await genOrder(bs, market, collateral2, collateralDepositAmount2, {
        desiredSize: order2.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader2, closeOrder2);

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
});
