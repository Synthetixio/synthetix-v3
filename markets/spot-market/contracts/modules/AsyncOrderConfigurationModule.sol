//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAsyncOrderConfigurationModule} from "../interfaces/IAsyncOrderConfigurationModule.sol";
import {AsyncOrderConfiguration} from "../storage/AsyncOrderConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";

/**
 * @title Module for configuring settings for async order module.
 * @dev See IAsyncOrderConfigurationModule.
 */
contract AsyncOrderConfigurationModule is IAsyncOrderConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        if (strategy.settlementWindowDuration == 0) {
            revert InvalidSettlementWindowDuration(strategy.settlementWindowDuration);
        }

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        AsyncOrderConfiguration.Data storage config = AsyncOrderConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);

        emit SettlementStrategyAdded(marketId, strategyId);
    }

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function setSettlementStrategy(
        uint128 marketId,
        uint256 strategyId,
        SettlementStrategy.Data memory strategy
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);
        AsyncOrderConfiguration.Data storage config = AsyncOrderConfiguration.load(marketId);
        config.validateStrategyExists(strategyId);

        if (strategy.settlementWindowDuration == 0) {
            revert InvalidSettlementWindowDuration(strategy.settlementWindowDuration);
        }

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;
        config.settlementStrategies[strategyId] = strategy;

        emit SettlementStrategySet(marketId, strategyId, strategy);
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
        AsyncOrderConfiguration.Data storage config = AsyncOrderConfiguration.load(marketId);
        config.validateStrategyExists(strategyId);

        SettlementStrategy.Data storage strategy = config.settlementStrategies[strategyId];
        strategy.disabled = !enabled;

        emit SettlementStrategySet(marketId, strategyId, strategy);
    }

    /**
     * @inheritdoc IAsyncOrderConfigurationModule
     */
    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view override returns (SettlementStrategy.Data memory settlementStrategy) {
        return AsyncOrderConfiguration.load(marketId).settlementStrategies[strategyId];
    }
}
