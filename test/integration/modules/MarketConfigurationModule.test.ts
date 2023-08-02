import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap } from '../../generators';

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
      const marketId = markets()[0].marketId();

      const bs = genBootstrap();
      const specific = bs.markets[0].specific;

      const tx = await PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific);
      const config = await PerpMarketProxy.getMarketConfigurationById(marketId);

      assert.equal(specific.oracleNodeId, config.oracleNodeId);
      assert.equal(specific.pythPriceFeedId, config.pythPriceFeedId);
      assertBn.equal(specific.skewScale, config.skewScale);
      assertBn.equal(specific.makerFee, config.makerFee);
      assertBn.equal(specific.takerFee, config.takerFee);
      assertBn.equal(specific.maxLeverage, config.maxLeverage);
      assertBn.equal(specific.maxMarketSize, config.maxMarketSize);
      assertBn.equal(specific.maxFundingVelocity, config.maxFundingVelocity);
      assertBn.equal(specific.minMarginUsd, config.minMarginUsd);
      assertBn.equal(specific.minMarginRatio, config.minMarginRatio);
      assertBn.equal(specific.initialMarginRatio, config.initialMarginRatio);
      assertBn.equal(specific.maintenanceMarginScalar, config.maintenanceMarginScalar);
      assertBn.equal(specific.liquidationRewardPercent, config.liquidationRewardPercent);

      await assertEvent(tx, `MarketConfigurationUpdated(${marketId}, "${await from.getAddress()}")`, PerpMarketProxy);
    });

    it('should revert with non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const marketId = markets()[0].marketId();

      const bs = genBootstrap();
      const specific = bs.markets[0].specific;

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific),
        `Unauthorized("${await from.getAddress()}")`
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      const marketId = bn(6969);

      const bs = genBootstrap();
      const specific = bs.markets[0].specific;

      await assertRevert(
        PerpMarketProxy.connect(from).setMarketConfigurationById(marketId, specific),
        `MarketNotFound("${marketId}")`
      );
    });
  });
});
