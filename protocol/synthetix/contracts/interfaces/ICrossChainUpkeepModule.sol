//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/FunctionsClientInterface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../storage/MarketConfiguration.sol";
import "../storage/PoolCrossChainInfo.sol";

/**
 * @title Module for management of pools which are cross chain capable
 */
interface ICrossChainUpkeepModule is AutomationCompatibleInterface {
    event PoolHeartbeat(uint128 poolId, PoolCrossChainSync.Data syncData);

    function _recvPoolHeartbeat(
        uint128 poolId,
        PoolCrossChainSync.Data memory syncData,
        int256 assignedDebt
    ) external;
}
