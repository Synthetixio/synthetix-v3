//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAsyncOrderConfigurationModule.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/SettlementStrategy.sol";
import "../storage/SpotMarketFactory.sol";

/**
 * @title Module for configuring settings for async order module.
 * @dev See IAsyncOrderConfigurationModule.
 */
contract AsyncOrderConfigurationModule is IAsyncOrderConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        AsyncOrderConfiguration.Data storage config = AsyncOrderConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);

        emit SettlementStrategyAdded(marketId, strategyId);
    }

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function setSettlementStrategyEnabled(
        uint128 marketId,
        uint256 strategyId,
        bool enabled
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);
        AsyncOrderConfiguration.load(marketId).settlementStrategies[strategyId].disabled = !enabled;

        emit SettlementStrategyUpdated(marketId, strategyId, enabled);
    }

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view override returns (SettlementStrategy.Data memory) {
        return AsyncOrderConfiguration.load(marketId).settlementStrategies[strategyId];
    }
}
