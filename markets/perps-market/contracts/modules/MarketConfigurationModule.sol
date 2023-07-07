//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {OrderFee} from "../storage/OrderFee.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 * @dev See IMarketConfigurationModule.
 */
contract MarketConfigurationModule is IMarketConfigurationModule {
    using PerpsMarket for PerpsMarket.Data;

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        PerpsMarket.load(marketId).onlyMarketOwner();

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);
        emit SettlementStrategyAdded(marketId, strategy, strategyId);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setSettlementStrategyEnabled(
        uint128 marketId,
        uint256 strategyId,
        bool enabled
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategies[strategyId]
            .disabled = !enabled;
        emit SettlementStrategyEnabled(marketId, strategyId, enabled);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setOrderFees(
        uint128 marketId,
        uint256 makerFeeRatio,
        uint256 takerFeeRatio
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.orderFees.makerFee = makerFeeRatio;
        config.orderFees.takerFee = takerFeeRatio;
        emit OrderFeesSet(marketId, makerFeeRatio, takerFeeRatio);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMaxMarketSize(uint128 marketId, uint256 maxMarketSize) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxMarketSize = maxMarketSize;
        emit MaxMarketSizeSet(marketId, maxMarketSize);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setFundingParameters(
        uint128 marketId,
        uint256 skewScale,
        uint256 maxFundingVelocity
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config.maxFundingVelocity = maxFundingVelocity;
        config.skewScale = skewScale;
        emit FundingParametersSet(marketId, skewScale, maxFundingVelocity);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setLiquidationParameters(
        uint128 marketId,
        uint256 initialMarginRatioD18,
        uint256 maintenanceMarginRatioD18,
        uint256 liquidationRewardRatioD18,
        uint256 maxLiquidationLimitAccumulationMultiplier,
        uint256 maxSecondsInLiquidationWindow,
        uint256 minimumPositionMargin
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config.initialMarginRatioD18 = initialMarginRatioD18;
        config.maintenanceMarginRatioD18 = maintenanceMarginRatioD18;
        config.liquidationRewardRatioD18 = liquidationRewardRatioD18;
        config
            .maxLiquidationLimitAccumulationMultiplier = maxLiquidationLimitAccumulationMultiplier;
        config.maxSecondsInLiquidationWindow = maxSecondsInLiquidationWindow;
        config.minimumPositionMargin = minimumPositionMargin;

        emit LiquidationParametersSet(
            marketId,
            initialMarginRatioD18,
            maintenanceMarginRatioD18,
            liquidationRewardRatioD18,
            maxLiquidationLimitAccumulationMultiplier,
            maxSecondsInLiquidationWindow,
            minimumPositionMargin
        );
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setLockedOiRatio(uint128 marketId, uint256 lockedOiRatioD18) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.lockedOiRatioD18 = lockedOiRatioD18;
        emit LockedOiRatioD18Set(marketId, lockedOiRatioD18);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view override returns (SettlementStrategy.Data memory settlementStrategy) {
        return PerpsMarketConfiguration.load(marketId).settlementStrategies[strategyId];
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getLiquidationParameters(
        uint128 marketId
    )
        external
        view
        override
        returns (
            uint256 initialMarginRatioD18,
            uint256 maintenanceMarginRatioD18,
            uint256 liquidationRewardRatioD18,
            uint256 maxLiquidationLimitAccumulationMultiplier,
            uint256 maxSecondsInLiquidationWindow
        )
    {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        initialMarginRatioD18 = config.initialMarginRatioD18;
        maintenanceMarginRatioD18 = config.maintenanceMarginRatioD18;
        liquidationRewardRatioD18 = config.liquidationRewardRatioD18;
        maxLiquidationLimitAccumulationMultiplier = config
            .maxLiquidationLimitAccumulationMultiplier;
        maxSecondsInLiquidationWindow = config.maxSecondsInLiquidationWindow;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getFundingParameters(
        uint128 marketId
    ) external view override returns (uint256 skewScale, uint256 maxFundingVelocity) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        skewScale = config.skewScale;
        maxFundingVelocity = config.maxFundingVelocity;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMaxMarketSize(
        uint128 marketId
    ) external view override returns (uint256 maxMarketSize) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        maxMarketSize = config.maxMarketSize;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getOrderFees(
        uint128 marketId
    ) external view override returns (uint256 makerFee, uint256 takerFee) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        makerFee = config.orderFees.makerFee;
        takerFee = config.orderFees.takerFee;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getLockedOiRatioD18(uint128 marketId) external view override returns (uint256) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        return config.lockedOiRatioD18;
    }
}
