//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";

interface IMarketConfigurationModule {
    // --- Structs --- //

    // @dev See PerpMarketConfiguration.GlobalData
    struct ConfigureParameters {
        uint128 priceDivergencePercent;
        uint128 pythPublishTimeMin;
        uint128 pythPublishTimeMax;
        uint128 minOrderAge;
        uint128 maxOrderAge;
        uint256 minKeeperFeeUsd;
        uint256 maxKeeperFeeUsd;
        uint128 keeperProfitMarginPercent;
        uint128 keeperSettlementGasUnits;
        uint128 keeperLiquidationGasUnits;
        uint256 keeperLiquidationFeeUsd;
        address keeperLiquidationEndorsed;
    }

    // @dev See PerpMarketConfiguration.Data
    struct ConfigureByMarketParameters {
        bytes32 oracleNodeId;
        bytes32 pythPriceFeedId;
        uint128 makerFee;
        uint128 takerFee;
        uint128 maxMarketSize;
        uint128 maxFundingVelocity;
        uint128 skewScale;
        uint128 minCreditPercent;
        uint256 minMarginUsd;
        uint256 minMarginRatio;
        uint256 incrementalMarginScalar;
        uint256 maintenanceMarginScalar;
        uint256 liquidationRewardPercent;
        uint128 liquidationLimitScalar;
        uint128 liquidationWindowDuration;
        uint128 liquidationMaxPd;
    }

    // --- Events --- //

    // @dev Emitted when the global market config is updated.
    event ConfigurationUpdated(address from);

    // @dev Emitted when parameters for a specific market is updated.
    event MarketConfigurationUpdated(uint128 marketId, address from);

    // --- Mutative --- //

    /**
     * @dev Configures parameters applied globally.
     */
    function setMarketConfiguration(IMarketConfigurationModule.ConfigureParameters memory data) external;

    /**
     * @dev Configures a specific market by the `marketId`.
     */
    function setMarketConfigurationById(
        uint128 marketId,
        IMarketConfigurationModule.ConfigureByMarketParameters memory data
    ) external;

    // --- Views --- //

    /**
     * @dev Returns global market parameters.
     */
    function getMarketConfiguration() external pure returns (PerpMarketConfiguration.GlobalData memory);

    /**
     * @dev Returns market specific parameters.
     */
    function getMarketConfigurationById(uint128 marketId) external pure returns (PerpMarketConfiguration.Data memory);
}
