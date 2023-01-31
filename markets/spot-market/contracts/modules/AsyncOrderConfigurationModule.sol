//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAsyncOrderConfigurationModule.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/SettlementStrategy.sol";
import "../storage/SpotMarketFactory.sol";

contract AsyncOrderConfigurationModule is IAsyncOrderConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;

    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        AsyncOrderConfiguration.load(marketId).settlementStrategies.push(strategy);
    }

    function removeSettlementStrategy(uint128 marketId, uint256 strategyId) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);
        delete AsyncOrderConfiguration.load(marketId).settlementStrategies[strategyId];
    }

    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view override returns (SettlementStrategy.Data memory) {
        return AsyncOrderConfiguration.load(marketId).settlementStrategies[strategyId];
    }
}
