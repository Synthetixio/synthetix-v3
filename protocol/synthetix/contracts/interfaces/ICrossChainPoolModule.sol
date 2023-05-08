//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/FunctionsClientInterface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../storage/MarketConfiguration.sol";
import "../storage/PoolCrossChainInfo.sol";

/**
 * @title Module for management of pools which are cross chain capable
 */
interface ICrossChainPoolModule is FunctionsClientInterface, AutomationCompatibleInterface {

    event PoolHeartbeat(uint128 poolId, PoolCrossChainSync.Data syncData);

    function createCrossChainPool(uint128 sourcePoolId, uint64 targetChainId) external returns (uint256 gasTokenUsed);

    function _recvCreateCrossChainPool(uint64 srcChainId, uint64 srcPoolId) external;

    function setCrossChainPoolConfiguration(
        uint128 poolId, 
        MarketConfiguration.Data[][] memory newMarketConfigurations
    ) external;
    
    function _recvSetCrossChainPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory newMarketConfigurations,
        uint256 newTotalWeight,
        uint64 configTimestamp
    ) external;

    function _recvPoolHeartbeat(uint128 poolId, PoolCrossChainSync.Data memory syncData, int256 assignedDebt) external;

    function getThisChainPoolLiquidity(
        uint128 poolId
    ) external view returns (uint256 liquidityD18);

    function getThisChainPoolCumulativeMarketDebt(
        uint128 poolId
    ) external returns (int256 cumulativeDebtD18);

    function getThisChainPoolTotalDebt(
        uint128 poolId
    ) external view returns (int256 totalDebtD18);

    function getPoolLastHeartbeat(uint128 poolId) external view returns (uint64);
}