//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IMarketConfigurationModule.sol";
import "../storage/SettlementStrategy.sol";
import "../storage/MarketConfiguration.sol";
import "../storage/PerpsMarket.sol";

contract MarketConfigurationModule is IMarketConfigurationModule {
    using PerpsMarket for PerpsMarket.Data;

    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external override returns (uint256 strategyId) {
        PerpsMarket.load(marketId).onlyMarketOwner();

        strategy.settlementDelay = strategy.settlementDelay == 0 ? 1 : strategy.settlementDelay;

        MarketConfiguration.Data storage config = MarketConfiguration.load(marketId);
        strategyId = config.settlementStrategies.length;

        config.settlementStrategies.push(strategy);
    }
}
