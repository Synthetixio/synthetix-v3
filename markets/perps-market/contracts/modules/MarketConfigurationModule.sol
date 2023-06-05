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
    }

    function setSkewScale(uint128 marketId, uint256 skewScale) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.load(marketId).skewScale = skewScale;
    }

    function setOrderFees(
        uint128 marketId,
        PerpsMarketConfiguration.OrderType key,
        OrderFee.Data memory value
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.orderFees[key] = value;
    }

    function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxMarketValue = maxMarketValue;
    }

    function setMaxFundingVelocity(uint128 marketId, uint256 maxFundingVelocity) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maxFundingVelocity = maxFundingVelocity;
    }

    function setInitialMarginFraction(
        uint128 marketId,
        uint256 initialMarginFraction
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.initialMarginFraction = initialMarginFraction;
    }

    function setMaintenanceMarginFraction(
        uint128 marketId,
        uint256 maintenanceMarginFraction
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.maintenanceMarginFraction = maintenanceMarginFraction;
    }

    function setLockedOiPercent(uint128 marketId, uint256 lockedOiPercent) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.lockedOiPercent = lockedOiPercent;
    }

    function setMaxLiquidationLimitAccumulationMultiplier(
        uint128 marketId,
        uint256 maxLiquidationLimitAccumulationMultiplier
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config
            .maxLiquidationLimitAccumulationMultiplier = maxLiquidationLimitAccumulationMultiplier;
    }

    function setLiquidationRewardRatioD18(
        uint128 marketId,
        uint256 liquidationRewardRatioD18
    ) external override {
        PerpsMarket.load(marketId).onlyMarketOwner();
        PerpsMarketConfiguration.Data storage config = PerpsMarketConfiguration.load(marketId);
        config.liquidationRewardRatioD18 = liquidationRewardRatioD18;
    }

    function getOrderFees(
        uint128 marketId,
        PerpsMarketConfiguration.OrderType key
    ) external view override returns (OrderFee.Data memory) {
        return PerpsMarketConfiguration.load(marketId).orderFees[key];
    }

    function getSettlementStrategy(
        uint128 marketId
    ) external view override returns (SettlementStrategy.Data[] memory) {
        return PerpsMarketConfiguration.load(marketId).settlementStrategies;
    }

    function getMaxMarketValue(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maxMarketValue;
    }

    function getMaxFundingVelocity(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maxFundingVelocity;
    }

    function getSkewScale(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).skewScale;
    }

    function getInitialMarginFraction(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).initialMarginFraction;
    }

    function getMaintenanceMarginFraction(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maintenanceMarginFraction;
    }

    function getLockedOiPercent(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).lockedOiPercent;
    }

    function getMaxLiquidationLimitAccumulationMultiplier(
        uint128 marketId
    ) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maxLiquidationLimitAccumulationMultiplier;
    }

    function getLiquidationRewardRatioD18(uint128 marketId) external view returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).liquidationRewardRatioD18;
    }
}
