//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/SettlementStrategy.sol";

interface IAsyncOrderConfigurationModule {
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external;

    function removeSettlementStrategy(uint128 marketId, uint256 strategyId) external;

    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view returns (SettlementStrategy.Data memory);
}
