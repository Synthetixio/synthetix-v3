//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {OrderFee} from "../storage/OrderFee.sol";

contract MarketConfigurationModule is IMarketConfigurationModule {
    using PerpsMarket for PerpsMarket.Data;

    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        PerpsMarket.load(marketId).onlyMarketOwner();

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);
        emit SettlementStrategyAdded(marketId, strategy);
    }

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

    function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxMarketValue = maxMarketValue;
        emit MaxMarketValueSet(marketId, maxMarketValue);
    }

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

    function setLiquidationParameters(
        uint128 marketId,
        uint256 initialMarginFraction,
        uint256 maintenanceMarginFraction,
        uint256 liquidationRewardRatioD18,
        uint256 maxLiquidationLimitAccumulationMultiplier
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        config.initialMarginFraction = initialMarginFraction;
        config.maintenanceMarginFraction = maintenanceMarginFraction;
        config.liquidationRewardRatioD18 = liquidationRewardRatioD18;
        config
            .maxLiquidationLimitAccumulationMultiplier = maxLiquidationLimitAccumulationMultiplier;
        emit LiquidationParametersSet(
            marketId,
            initialMarginFraction,
            maintenanceMarginFraction,
            liquidationRewardRatioD18,
            maxLiquidationLimitAccumulationMultiplier
        );
    }

    function setLockedOiPercent(uint128 marketId, uint256 lockedOiPercent) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.lockedOiPercent = lockedOiPercent;
        emit LockedOiPercentSet(marketId, lockedOiPercent);
    }

    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view override returns (SettlementStrategy.Data memory settlementStrategy) {
        return PerpsMarketConfiguration.load(marketId).settlementStrategies[strategyId];
    }

    function getLiquidationParameters(
        uint128 marketId
    )
        external
        view
        override
        returns (
            uint256 initialMarginFraction,
            uint256 maintenanceMarginFraction,
            uint256 liquidationRewardRatioD18,
            uint256 maxLiquidationLimitAccumulationMultiplier
        )
    {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        initialMarginFraction = config.initialMarginFraction;
        maintenanceMarginFraction = config.maintenanceMarginFraction;
        liquidationRewardRatioD18 = config.liquidationRewardRatioD18;
        maxLiquidationLimitAccumulationMultiplier = config
            .maxLiquidationLimitAccumulationMultiplier;
    }

    function getFundingParameters(
        uint128 marketId
    ) external view override returns (uint256 skewScale, uint256 maxFundingVelocity) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        skewScale = config.skewScale;
        maxFundingVelocity = config.maxFundingVelocity;
    }

    function getMaxMarketValue(
        uint128 marketId
    ) external view override returns (uint256 maxMarketValue) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        maxMarketValue = config.maxMarketValue;
    }

    function getOrderFees(
        uint128 marketId
    ) external view override returns (uint256 makerFee, uint256 takerFee) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        makerFee = config.orderFees.makerFee;
        takerFee = config.orderFees.takerFee;
    }

    function getLockedOiPercent(uint128 marketId) external view override returns (uint256) {
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);

        return config.lockedOiPercent;
    }
}
