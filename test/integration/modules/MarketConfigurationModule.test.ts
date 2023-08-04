import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { bootstrap } from '../../bootstrap';
import { genBootstrap, genMarket, genOneOf } from '../../generators';
import { bn } from '../../utils';

describe('MarketConfigurationModule', async () => {
  const bs = bootstrap(genBootstrap());
  const { markets, traders, owner, systems, restore } = bs;

  beforeEach(restore);

  describe('setMarketConfiguration', () => {
    it('should successfully configure market', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const { global } = genBootstrap();
      const tx = await PerpMarketProxy.connect(from).setMarketConfiguration(global);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assertBn.equal(config.priceDivergencePercent, global.priceDivergencePercent);
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

      await assertEvent(tx, `ConfigurationUpdated("${await from.getAddress()}")`, PerpMarketProxy);
    });

    it('should revert with non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;

      const { global } = genBootstrap();
      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfiguration(global),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('setMarketConfigurationById', () => {
    it('should successfully configure market by id', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Randomly select a market currently available and new params for said market.
      const marketId = genOneOf(markets()).marketId();
      const { specific } = genMarket();

      const tx = await PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific);
      const config = await PerpMarketProxy.getMarketConfigurationById(marketId);

      assert.equal(specific.oracleNodeId, config.oracleNodeId);
      assert.equal(specific.pythPriceFeedId, config.pythPriceFeedId);
      assertBn.equal(specific.skewScale, config.skewScale);
      assertBn.equal(specific.makerFee, config.makerFee);
      assertBn.equal(specific.takerFee, config.takerFee);
      assertBn.equal(specific.maxMarketSize, config.maxMarketSize);
      assertBn.equal(specific.maxFundingVelocity, config.maxFundingVelocity);
      assertBn.equal(specific.minMarginUsd, config.minMarginUsd);
      assertBn.equal(specific.minMarginRatio, config.minMarginRatio);
      assertBn.equal(specific.incrementalMarginScalar, config.incrementalMarginScalar);
      assertBn.equal(specific.maintenanceMarginScalar, config.maintenanceMarginScalar);
      assertBn.equal(specific.liquidationRewardPercent, config.liquidationRewardPercent);
      assertBn.equal(specific.liquidationLimitScalar, config.liquidationLimitScalar);
      assertBn.equal(specific.liquidationWindowTime, config.liquidationWindowTime);

      await assertEvent(tx, `MarketConfigurationUpdated(${marketId}, "${await from.getAddress()}")`, PerpMarketProxy);
    });

    it('should revert with non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer; // not owner.

      // Randomly select a market currently available and new params for said market.
      const marketId = genOneOf(markets()).marketId();
      const { specific } = genMarket();

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific),
        `Unauthorized("${await from.getAddress()}")`
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      const notFoundMarketId = bn(4206969);
      const { specific } = genMarket();

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(notFoundMarketId, specific),
        `MarketNotFound("${notFoundMarketId}")`
      );
    });
  });
});
