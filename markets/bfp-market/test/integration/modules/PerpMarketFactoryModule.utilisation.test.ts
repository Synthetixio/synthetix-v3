import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf, genOrder, genTrader } from '../../generators';
import {
  commitAndSettle,
  depositMargin,
  setMarketConfiguration,
  setMarketConfigurationById,
} from '../../helpers';

describe('PerpMarketFactoryModule Utilization', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, systems, restore } = bs;

  beforeEach(restore);

  describe('Market digest UtilizationRate', () => {
    it('should be 0 when no position', async () => {
      const { PerpMarketProxy } = systems();
      const market = genOneOf(markets());
      const marketDigest = await PerpMarketProxy.getMarketDigest(market.marketId());
      assertBn.equal(marketDigest.utilizationRate, bn(0));
    });

    it('should handle utilization config set to 0', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);
      await commitAndSettle(bs, marketId, trader, order);

      const marketDigest = await PerpMarketProxy.getMarketDigest(market.marketId());

      // Should not be 0 as our settlement has recomputed utilization
      assertBn.notEqual(marketDigest.utilizationRate, bn(0));
      // Set config values to 0
      await setMarketConfiguration(bs, {
        utilizationBreakpointPercent: 0,
        lowUtilizationSlopePercent: 0,
        highUtilizationSlopePercent: 0,
      });
      const marketDigest1 = await PerpMarketProxy.getMarketDigest(market.marketId());
      // Should not be 0 as utilization has not been recomputed yet
      assertBn.notEqual(marketDigest1.utilizationRate, bn(0));

      await PerpMarketProxy.recomputeUtilization(marketId);
      const marketDigest2 = await PerpMarketProxy.getMarketDigest(market.marketId());
      // We now expect utilization to be 0
      assertBn.equal(marketDigest2.utilizationRate, bn(0));
    });

    forEach(['lowUtilization', 'highUtilization']).it(
      'should return current utilization rate when %s',
      async (variant) => {
        const { PerpMarketProxy, Core } = systems();
        const globalMarketConfig = await PerpMarketProxy.getMarketConfiguration();
        const utilizationBreakpointPercent = wei(globalMarketConfig.utilizationBreakpointPercent);
        const lowUtilizationSlopePercent = wei(globalMarketConfig.lowUtilizationSlopePercent);
        const highUtilizationSlopePercent = wei(globalMarketConfig.highUtilizationSlopePercent);
        const market = genOneOf(markets());
        const marketConfig = await PerpMarketProxy.getMarketConfigurationById(market.marketId());

        // Create random utilization rate
        const breakPointNumber = utilizationBreakpointPercent.mul(100).toNumber();
        const utilization =
          variant === 'lowUtilization'
            ? Math.floor(genNumber(1, breakPointNumber))
            : Math.floor(genNumber(breakPointNumber, 100));
        const targetUtilizationPercent = wei(utilization).div(100);

        // Get delegated usd amount
        const withdrawable = await Core.getWithdrawableMarketUsd(market.marketId());
        const { totalCollateralValueUsd } = await PerpMarketProxy.getMarketDigest(
          market.marketId()
        );
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
        const marketDigest = await PerpMarketProxy.getMarketDigest(market.marketId());
        if (variant === 'lowUtilization') {
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
