//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 * @dev See IMarketConfigurationModule.
 */
contract MarketConfigurationModule is IMarketConfigurationModule {
    using PerpsPrice for PerpsPrice.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        OwnableStorage.onlyOwner();

        if (strategy.settlementWindowDuration == 0) {
            revert InvalidSettlementWindowDuration(strategy.settlementWindowDuration);
        }

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);
        emit SettlementStrategyAdded(marketId, strategy, strategyId);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setSettlementStrategy(
        uint128 marketId,
        uint256 strategyId,
        SettlementStrategy.Data memory strategy
    ) external override {
        OwnableStorage.onlyOwner();

        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.validateStrategyExists(strategyId);

        if (strategy.settlementWindowDuration == 0) {
            revert InvalidSettlementWindowDuration(strategy.settlementWindowDuration);
        }

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;
        config.settlementStrategies[strategyId] = strategy;

        emit SettlementStrategySet(marketId, strategyId, strategy);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setSettlementStrategyEnabled(
        uint128 marketId,
        uint256 strategyId,
        bool enabled
    ) external override {
        OwnableStorage.onlyOwner();

        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.validateStrategyExists(strategyId);

        SettlementStrategy.Data storage strategy = config.settlementStrategies[strategyId];
        strategy.disabled = !enabled;

        emit SettlementStrategySet(marketId, strategyId, strategy);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setOrderFees(
        uint128 marketId,
        uint256 makerFeeRatio,
        uint256 takerFeeRatio
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.orderFees.makerFee = makerFeeRatio;
        config.orderFees.takerFee = takerFeeRatio;
        emit OrderFeesSet(marketId, makerFeeRatio, takerFeeRatio);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function updatePriceData(
        uint128 perpsMarketId,
        bytes32 feedId,
        uint256 strictStalenessTolerance
    ) external override {
        OwnableStorage.onlyOwner();

        PerpsPrice.load(perpsMarketId).update(feedId, strictStalenessTolerance);

        emit MarketPriceDataUpdated(perpsMarketId, feedId, strictStalenessTolerance);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getPriceData(
        uint128 perpsMarketId
    ) external view returns (bytes32 feedId, uint256 strictStalenessTolerance) {
        PerpsPrice.Data storage priceData = PerpsPrice.load(perpsMarketId);
        feedId = priceData.feedId;
        strictStalenessTolerance = priceData.strictStalenessTolerance;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMaxMarketSize(uint128 marketId, uint256 maxMarketSize) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxMarketSize = maxMarketSize;
        emit MaxMarketSizeSet(marketId, maxMarketSize);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxMarketValue = maxMarketValue;
        emit MaxMarketValueSet(marketId, maxMarketValue);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setFundingParameters(
        uint128 marketId,
        uint256 skewScale,
        uint256 maxFundingVelocity
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config.maxFundingVelocity = maxFundingVelocity;
        config.skewScale = skewScale;
        emit FundingParametersSet(marketId, skewScale, maxFundingVelocity);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMaxLiquidationParameters(
        uint128 marketId,
        uint256 maxLiquidationLimitAccumulationMultiplier,
        uint256 maxSecondsInLiquidationWindow,
        uint256 maxLiquidationPd,
        address endorsedLiquidator
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config
            .maxLiquidationLimitAccumulationMultiplier = maxLiquidationLimitAccumulationMultiplier;
        config.maxLiquidationPd = maxLiquidationPd;
        config.endorsedLiquidator = endorsedLiquidator;
        config.maxSecondsInLiquidationWindow = maxSecondsInLiquidationWindow;

        emit MaxLiquidationParametersSet(
            marketId,
            maxLiquidationLimitAccumulationMultiplier,
            maxSecondsInLiquidationWindow,
            maxLiquidationPd,
            endorsedLiquidator
        );
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setLiquidationParameters(
        uint128 marketId,
        uint256 initialMarginRatioD18,
        uint256 minimumInitialMarginRatioD18,
        uint256 maintenanceMarginScalarD18,
        uint256 flagRewardRatioD18,
        uint256 minimumPositionMargin
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config.initialMarginRatioD18 = initialMarginRatioD18;
        config.maintenanceMarginScalarD18 = maintenanceMarginScalarD18;
        config.minimumInitialMarginRatioD18 = minimumInitialMarginRatioD18;
        config.flagRewardRatioD18 = flagRewardRatioD18;
        config.minimumPositionMargin = minimumPositionMargin;

        emit LiquidationParametersSet(
            marketId,
            initialMarginRatioD18,
            maintenanceMarginScalarD18,
            minimumInitialMarginRatioD18,
            flagRewardRatioD18,
            minimumPositionMargin
        );
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setLockedOiRatio(uint128 marketId, uint256 lockedOiRatioD18) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.lockedOiRatioD18 = lockedOiRatioD18;
        emit LockedOiRatioSet(marketId, lockedOiRatioD18);
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
    function getMaxLiquidationParameters(
        uint128 marketId
    )
        external
        view
        override
        returns (
            uint256 maxLiquidationLimitAccumulationMultiplier,
            uint256 maxSecondsInLiquidationWindow,
            uint256 maxLiquidationPd,
            address endorsedLiquidator
        )
    {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        maxLiquidationLimitAccumulationMultiplier = config
            .maxLiquidationLimitAccumulationMultiplier;
        maxSecondsInLiquidationWindow = config.maxSecondsInLiquidationWindow;
        maxLiquidationPd = config.maxLiquidationPd;
        endorsedLiquidator = config.endorsedLiquidator;
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
            uint256 minimumInitialMarginRatioD18,
            uint256 maintenanceMarginScalarD18,
            uint256 flagRewardRatioD18,
            uint256 minimumPositionMargin
        )
    {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        initialMarginRatioD18 = config.initialMarginRatioD18;
        minimumInitialMarginRatioD18 = config.minimumInitialMarginRatioD18;
        maintenanceMarginScalarD18 = config.maintenanceMarginScalarD18;
        flagRewardRatioD18 = config.flagRewardRatioD18;
        minimumPositionMargin = config.minimumPositionMargin;
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
    function getMaxMarketValue(
        uint128 marketId
    ) external view override returns (uint256 maxMarketValue) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        maxMarketValue = config.maxMarketValue;
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
    function getLockedOiRatio(uint128 marketId) external view override returns (uint256) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        return config.lockedOiRatioD18;
    }
}
