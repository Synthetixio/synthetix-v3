//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";

interface IMarketConfigurationModule {
    // --- Structs --- //

    // @notice See PerpMarketConfiguration.GlobalData for more details.
    struct ConfigureParameters {
        uint64 pythPublishTimeMin;
        uint64 pythPublishTimeMax;
        uint128 minOrderAge;
        uint128 maxOrderAge;
        uint256 minKeeperFeeUsd;
        uint256 maxKeeperFeeUsd;
        uint128 keeperProfitMarginPercent;
        uint128 keeperProfitMarginUsd;
        uint128 keeperSettlementGasUnits;
        uint128 keeperLiquidationGasUnits;
        uint256 keeperLiquidationFeeUsd;
        uint128 keeperFlagGasUnits;
        uint128 keeperLiquidateMarginGasUnits;
        address keeperLiquidationEndorsed;
        uint128 collateralDiscountScalar;
        uint128 minCollateralDiscount;
        uint128 maxCollateralDiscount;
        uint128 sellExactInMaxSlippagePercent;
        uint128 utilizationBreakpointPercent;
        uint128 lowUtilizationSlopePercent;
        uint128 highUtilizationSlopePercent;
    }

    // @notice See PerpMarketConfiguration.Data for more details.
    struct ConfigureByMarketParameters {
        bytes32 oracleNodeId;
        bytes32 pythPriceFeedId;
        uint128 makerFee;
        uint128 takerFee;
        uint128 maxMarketSize;
        uint128 maxFundingVelocity;
        uint128 skewScale;
        uint128 fundingVelocityClamp;
        uint128 minCreditPercent;
        uint256 minMarginUsd;
        uint256 minMarginRatio;
        uint256 incrementalMarginScalar;
        uint256 maintenanceMarginScalar;
        uint256 maxInitialMarginRatio;
        uint256 liquidationRewardPercent;
        uint128 liquidationLimitScalar;
        uint128 liquidationWindowDuration;
        uint128 liquidationMaxPd;
    }

    // --- Events --- //

    // @notice Emitted when the global market config is updated.
    event ConfigurationUpdated(address from);

    // @notice Emitted when parameters for a specific market is updated.
    event MarketConfigurationUpdated(uint128 marketId, address from);

    // --- Mutations --- //

    /**
     * @notice Configures market parameters applied globally.
     */
    function setMarketConfiguration(
        IMarketConfigurationModule.ConfigureParameters memory data
    ) external;

    /**
     * @notice Configures a market specific parameters applied to the `marketId`.
     */
    function setMarketConfigurationById(
        uint128 marketId,
        IMarketConfigurationModule.ConfigureByMarketParameters memory data
    ) external;

    // --- Views --- //

    /**
     * @notice Returns configured global market parameters.
     */
    function getMarketConfiguration()
        external
        view
        returns (PerpMarketConfiguration.GlobalData memory);

    /**
     * @notice Returns configured market specific parameters.
     */
    function getMarketConfigurationById(
        uint128 marketId
    ) external view returns (PerpMarketConfiguration.Data memory);
}
