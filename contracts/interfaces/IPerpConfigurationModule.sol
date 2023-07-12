//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";

interface IPerpConfigurationModule {
    // --- Structs --- //

    // @dev See PerpMarketConfiguration.GlobalData
    struct ConfigureParameters {
        uint256 minMarginUsd;
        uint128 priceDivergencePercent;
        int128 pythPublishTimeMin;
        int128 pythPublishTimeMax;
        uint128 minOrderAge;
        uint128 maxOrderAge;
        uint256 minKeeperFeeUsd;
        uint256 maxKeeperFeeUsd;
        uint128 keeperProfitMarginPercent;
        uint256 keeperSettlementGasUnits;
        uint256 keeperLiquidationGasUnits;
        uint256 keeperLiquidationFeeUsd;
    }

    // @dev See PerpMarketConfiguration.Data
    struct ConfigureByMarketParameters {
        bytes32 oracleNodeId;
        bytes32 pythPriceFeedId;
        uint128 skewScale;
        uint128 makerFee;
        uint128 takerFee;
        uint128 maxLeverage;
        uint128 maxMarketSize;
        uint128 maxFundingVelocity;
        uint256 liquidationBufferPercent;
        uint256 liquidationFeePercent;
        uint256 liquidationPremiumMultiplier;
    }

    // --- Mutative --- //

    /**
     * @dev Configures a specific market by the `marketId`.
     */
    function configure(uint128 marketId, IPerpConfigurationModule.ConfigureByMarketParameters memory data) external;

    /**
     * @dev Configures parameters applied globally.
     */
    function configure(IPerpConfigurationModule.ConfigureParameters memory data) external;
}
