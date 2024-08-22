//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

contract MarketConfigurationModule is IMarketConfigurationModule {
    // --- Immutables --- //

    address immutable SYNTHETIX_CORE;
    address immutable SYNTHETIX_SUSD;
    address immutable ORACLE_MANAGER;

    constructor(address _synthetix) {
        SYNTHETIX_CORE = _synthetix;
        ISynthetixSystem core = ISynthetixSystem(_synthetix);
        SYNTHETIX_SUSD = address(core.getUsdToken());
        ORACLE_MANAGER = address(core.getOracleManager());

        if (
            _synthetix == address(0) || ORACLE_MANAGER == address(0) || SYNTHETIX_SUSD == address(0)
        ) {
            revert ErrorUtil.InvalidCoreAddress(_synthetix);
        }
    }

    /// @inheritdoc IMarketConfigurationModule
    function setMarketConfiguration(
        IMarketConfigurationModule.GlobalMarketConfigureParameters memory data
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
        config.keeperCancellationGasUnits = data.keeperCancellationGasUnits;
        config.keeperFlagGasUnits = data.keeperFlagGasUnits;
        config.keeperLiquidateMarginGasUnits = data.keeperLiquidateMarginGasUnits;
        config.keeperLiquidationEndorsed = data.keeperLiquidationEndorsed;
        config.collateralDiscountScalar = data.collateralDiscountScalar;
        config.minCollateralDiscount = data.minCollateralDiscount;
        config.maxCollateralDiscount = data.maxCollateralDiscount;
        config.utilizationBreakpointPercent = data.utilizationBreakpointPercent;
        config.lowUtilizationSlopePercent = data.lowUtilizationSlopePercent;
        config.highUtilizationSlopePercent = data.highUtilizationSlopePercent;

        emit GlobalMarketConfigured(ERC2771Context._msgSender());
    }

    /// @inheritdoc IMarketConfigurationModule
    function setMarketConfigurationById(
        IMarketConfigurationModule.ConfigureByMarketParameters memory data
    ) external {
        OwnableStorage.onlyOwner();
        uint128 marketId = data.marketId;

        // Only allow an existing per market to be configurable. Ensure it's first created then configure.
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        if (market.skew != 0) {
            AddressRegistry.Data memory addresses = AddressRegistry.Data({
                synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                sUsd: SYNTHETIX_SUSD,
                oracleManager: ORACLE_MANAGER
            });

            uint256 oraclePrice = PerpMarket.getOraclePrice(market, addresses);
            (int128 fundingRate, , int128 fundingVelocity) = PerpMarket.recomputeFunding(
                market,
                oraclePrice
            );
            emit FundingRecomputed(marketId, market.skew, fundingRate, fundingVelocity);
        }

        PerpMarketConfiguration.Data storage config = PerpMarketConfiguration.load(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        if (data.minMarginUsd < globalConfig.maxKeeperFeeUsd) {
            revert ErrorUtil.InvalidParameter(
                "minMarginUsd",
                "minMarginUsd cannot be less than maxKeeperFeeUsd"
            );
        }

        if (data.skewScale == 0) {
            revert ErrorUtil.InvalidParameter("skewScale", "ZeroAmount");
        }

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
        config.maxInitialMarginRatio = data.maxInitialMarginRatio;
        config.liquidationRewardPercent = data.liquidationRewardPercent;
        config.liquidationLimitScalar = data.liquidationLimitScalar;
        config.liquidationWindowDuration = data.liquidationWindowDuration;
        config.liquidationMaxPd = data.liquidationMaxPd;

        emit MarketConfigured(marketId, ERC2771Context._msgSender());
    }

    /// @inheritdoc IMarketConfigurationModule
    function setMinDelegationTime(uint128 marketId, uint32 minDelegationTime) external {
        OwnableStorage.onlyOwner();
        ISynthetixSystem(SYNTHETIX_CORE).setMarketMinDelegateTime(marketId, minDelegationTime);
    }

    // --- Views --- //

    /// @inheritdoc IMarketConfigurationModule
    function getMarketConfiguration()
        external
        pure
        returns (PerpMarketConfiguration.GlobalData memory)
    {
        return PerpMarketConfiguration.load();
    }

    /// @inheritdoc IMarketConfigurationModule
    function getMarketConfigurationById(
        uint128 marketId
    ) external pure returns (PerpMarketConfiguration.Data memory) {
        return PerpMarketConfiguration.load(marketId);
    }
}
