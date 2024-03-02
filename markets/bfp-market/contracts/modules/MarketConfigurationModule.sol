//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";

contract MarketConfigurationModule is IMarketConfigurationModule {
    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMarketConfiguration(
        IMarketConfigurationModule.ConfigureParameters memory data
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage config = PerpMarketConfiguration.load();

        config.pythPublishTimeMin = data.pythPublishTimeMin;
        config.pythPublishTimeMax = data.pythPublishTimeMax;
        config.minOrderAge = data.minOrderAge;
        config.maxOrderAge = data.maxOrderAge;
        config.minKeeperFeeUsd = data.minKeeperFeeUsd;
        config.maxKeeperFeeUsd = data.maxKeeperFeeUsd;
        config.keeperProfitMarginPercent = data.keeperProfitMarginPercent;
        config.keeperProfitMarginUsd = data.keeperProfitMarginUsd;
        config.keeperSettlementGasUnits = data.keeperSettlementGasUnits;
        config.keeperLiquidationGasUnits = data.keeperLiquidationGasUnits;
        config.keeperFlagGasUnits = data.keeperFlagGasUnits;
        config.keeperLiquidateMarginGasUnits = data.keeperLiquidateMarginGasUnits;
        config.keeperLiquidationFeeUsd = data.keeperLiquidationFeeUsd;
        config.keeperLiquidationEndorsed = data.keeperLiquidationEndorsed;
        config.collateralDiscountScalar = data.collateralDiscountScalar;
        config.minCollateralDiscount = data.minCollateralDiscount;
        config.maxCollateralDiscount = data.maxCollateralDiscount;
        config.sellExactInMaxSlippagePercent = data.sellExactInMaxSlippagePercent;
        config.utilizationBreakpointPercent = data.utilizationBreakpointPercent;
        config.lowUtilizationSlopePercent = data.lowUtilizationSlopePercent;
        config.highUtilizationSlopePercent = data.highUtilizationSlopePercent;

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
        config.makerFee = data.makerFee;
        config.takerFee = data.takerFee;
        config.maxMarketSize = data.maxMarketSize;
        config.maxFundingVelocity = data.maxFundingVelocity;
        config.skewScale = data.skewScale;
        config.fundingVelocityClamp = data.fundingVelocityClamp;
        config.minCreditPercent = data.minCreditPercent;
        config.minMarginUsd = data.minMarginUsd;
        config.minMarginRatio = data.minMarginRatio;
        config.incrementalMarginScalar = data.incrementalMarginScalar;
        config.maintenanceMarginScalar = data.maintenanceMarginScalar;
        config.liquidationRewardPercent = data.liquidationRewardPercent;
        config.liquidationLimitScalar = data.liquidationLimitScalar;
        config.liquidationWindowDuration = data.liquidationWindowDuration;
        config.liquidationMaxPd = data.liquidationMaxPd;

        emit MarketConfigurationUpdated(marketId, msg.sender);
    }

    // --- Views --- //

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketConfiguration()
        external
        pure
        returns (PerpMarketConfiguration.GlobalData memory)
    {
        return PerpMarketConfiguration.load();
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketConfigurationById(
        uint128 marketId
    ) external pure returns (PerpMarketConfiguration.Data memory) {
        return PerpMarketConfiguration.load(marketId);
    }
}
