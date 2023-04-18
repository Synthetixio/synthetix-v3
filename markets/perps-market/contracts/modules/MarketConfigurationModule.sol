//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";

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
}
