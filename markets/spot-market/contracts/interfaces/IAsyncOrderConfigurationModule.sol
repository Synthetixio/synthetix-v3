//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/SettlementStrategy.sol";

interface IAsyncOrderConfigurationModule {
    event SettlementStrategyAdded(uint128 marketId, uint256 strategyId);

    event SettlementStrategyUpdated(uint128 marketId, uint256 strategyId, bool enabled);

    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external returns (uint256 strategyId);

    function setSettlementStrategyEnabled(
        uint128 marketId,
        uint256 strategyId,
        bool enabled
    ) external;

    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view returns (SettlementStrategy.Data memory);
}
