import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genMarket, genOneOf } from '../../generators';
import { withExplicitEvmMine } from '../../helpers';

describe('MarketConfigurationModule', async () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, owner, systems, restore, provider } = bs;

  beforeEach(restore);

  describe('setMarketConfiguration', () => {
    it('should configure market', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const { global } = genBootstrap();
      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(from).setMarketConfiguration(global),
        provider()
      );
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert.equal(config.pythPublishTimeMin, global.pythPublishTimeMin);
      assert.equal(config.pythPublishTimeMax, global.pythPublishTimeMax);
      assert.equal(config.minOrderAge, global.minOrderAge);
      assert.equal(config.maxOrderAge, global.maxOrderAge);
      assertBn.equal(config.minKeeperFeeUsd, global.minKeeperFeeUsd);
      assertBn.equal(config.maxKeeperFeeUsd, global.maxKeeperFeeUsd);
      assertBn.equal(config.keeperProfitMarginPercent, global.keeperProfitMarginPercent);
      assert.equal(config.keeperSettlementGasUnits, global.keeperSettlementGasUnits);
      assert.equal(config.keeperLiquidationGasUnits, global.keeperLiquidationGasUnits);
      assertBn.equal(config.keeperLiquidationFeeUsd, global.keeperLiquidationFeeUsd);
      assertBn.equal(config.collateralDiscountScalar, global.collateralDiscountScalar);
      assertBn.equal(config.minCollateralDiscount, global.minCollateralDiscount);
      assertBn.equal(config.maxCollateralDiscount, global.maxCollateralDiscount);
      assertBn.equal(config.sellExactInMaxSlippagePercent, global.sellExactInMaxSlippagePercent);
      assertBn.equal(config.utilizationBreakpointPercent, global.utilizationBreakpointPercent);
      assertBn.equal(config.lowUtilizationSlopePercent, global.lowUtilizationSlopePercent);
      assertBn.equal(config.highUtilizationSlopePercent, global.highUtilizationSlopePercent);
      assertBn.equal(config.keeperProfitMarginUsd, global.keeperProfitMarginUsd);
      assert.equal(config.keeperFlagGasUnits, global.keeperFlagGasUnits);
      assert.equal(config.keeperLiquidationEndorsed, global.keeperLiquidationEndorsed);
      assert.equal(config.keeperLiquidateMarginGasUnits, global.keeperLiquidateMarginGasUnits);

      await assertEvent(
        receipt,
        `ConfigurationUpdated("${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;

      const { global } = genBootstrap();
      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfiguration(global),
        `Unauthorized("${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });
  });

  describe('setMarketConfigurationById', () => {
    it('should configure market by id', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Randomly select a market currently available and new params for said market.
      const marketId = genOneOf(markets()).marketId();
      const { specific } = genMarket();

      const { receipt } = await withExplicitEvmMine(
        () => PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific),
        provider()
      );

      const config = await PerpMarketProxy.getMarketConfigurationById(marketId);

      assert.equal(specific.oracleNodeId, config.oracleNodeId);
      assert.equal(specific.pythPriceFeedId, config.pythPriceFeedId);

      assertBn.equal(specific.makerFee, config.makerFee);
      assertBn.equal(specific.takerFee, config.takerFee);
      assertBn.equal(specific.maxMarketSize, config.maxMarketSize);
      assertBn.equal(specific.maxFundingVelocity, config.maxFundingVelocity);
      assertBn.equal(specific.skewScale, config.skewScale);
      assertBn.equal(specific.fundingVelocityClamp, config.fundingVelocityClamp);
      assertBn.equal(specific.minCreditPercent, config.minCreditPercent);
      assertBn.equal(specific.minMarginUsd, config.minMarginUsd);
      assertBn.equal(specific.minMarginRatio, config.minMarginRatio);
      assertBn.equal(specific.incrementalMarginScalar, config.incrementalMarginScalar);
      assertBn.equal(specific.maintenanceMarginScalar, config.maintenanceMarginScalar);
      assertBn.equal(specific.liquidationRewardPercent, config.liquidationRewardPercent);
      assertBn.equal(specific.liquidationLimitScalar, config.liquidationLimitScalar);
      assertBn.equal(specific.liquidationWindowDuration, config.liquidationWindowDuration);

      await assertEvent(
        receipt,
        `MarketConfigurationUpdated(${marketId}, "${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer; // not owner.

      // Randomly select a market currently available and new params for said market.
      const marketId = genOneOf(markets()).marketId();
      const { specific } = genMarket();

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific),
        `Unauthorized("${await from.getAddress()}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      const notFoundMarketId = bn(4206969);
      const { specific } = genMarket();

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(notFoundMarketId, specific),
        `MarketNotFound("${notFoundMarketId}")`,
        PerpMarketProxy
      );
    });
  });
});
