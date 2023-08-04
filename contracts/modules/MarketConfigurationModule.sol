//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import "../interfaces/IMarketConfigurationModule.sol";

contract MarketConfigurationModule is IMarketConfigurationModule {
    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMarketConfiguration(IMarketConfigurationModule.ConfigureParameters memory data) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage config = PerpMarketConfiguration.load();

        config.priceDivergencePercent = data.priceDivergencePercent;
        config.pythPublishTimeMin = data.pythPublishTimeMin;
        config.pythPublishTimeMax = data.pythPublishTimeMax;
        config.minOrderAge = data.minOrderAge;
        config.maxOrderAge = data.maxOrderAge;
        config.minKeeperFeeUsd = data.minKeeperFeeUsd;
        config.maxKeeperFeeUsd = data.maxKeeperFeeUsd;
        config.keeperProfitMarginPercent = data.keeperProfitMarginPercent;
        config.keeperSettlementGasUnits = data.keeperSettlementGasUnits;
        config.keeperLiquidationGasUnits = data.keeperLiquidationGasUnits;
        config.keeperLiquidationFeeUsd = data.keeperLiquidationFeeUsd;

        emit ConfigurationUpdated(msg.sender);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMarketConfigurationById(
        uint128 marketId,
        IMarketConfigurationModule.ConfigureByMarketParameters memory data
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.Data storage config = PerpMarketConfiguration.load(marketId);

        // Only allow an existing per market to be configurable. Ensure it's first created then configure.
        PerpMarket.exists(marketId);

        config.oracleNodeId = data.oracleNodeId;
        config.pythPriceFeedId = data.pythPriceFeedId;
        config.skewScale = data.skewScale;
        config.makerFee = data.makerFee;
        config.takerFee = data.takerFee;
        config.maxMarketSize = data.maxMarketSize;
        config.maxFundingVelocity = data.maxFundingVelocity;
        config.minMarginUsd = data.minMarginUsd;
        config.minMarginRatio = data.minMarginRatio;
        config.incrementalMarginScalar = data.incrementalMarginScalar;
        config.maintenanceMarginScalar = data.maintenanceMarginScalar;
        config.liquidationRewardPercent = data.liquidationRewardPercent;
        config.liquidationCapacity = data.liquidationCapacity;
        config.liquidationWindowTime = data.liquidationWindowTime;

        emit MarketConfigurationUpdated(marketId, msg.sender);
    }

    // --- Views --- //

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketConfiguration() external pure returns (PerpMarketConfiguration.GlobalData memory) {
        return PerpMarketConfiguration.load();
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketConfigurationById(uint128 marketId) external pure returns (PerpMarketConfiguration.Data memory) {
        return PerpMarketConfiguration.load(marketId);
    }
}
