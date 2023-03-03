//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/SettlementStrategy.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 */
interface IMarketConfigurationModule {
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external returns (uint256 strategyId);

    function setSkewScale(uint128 marketId, uint256 skewScale) external;
}
