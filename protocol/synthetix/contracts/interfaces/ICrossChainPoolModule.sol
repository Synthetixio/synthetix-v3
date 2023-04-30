//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/FunctionsClientInterface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

/**
 * @title Module for management of pools which are cross chain capable
 */
interface IPoolModule is FunctionsClientInterface, AutomationCompatibleInterface {
    /**
     * @notice Creates a pool with the requested pool id.
     * @param requestedPoolId The requested id for the new pool. Reverts if the id is not available.
     * @param owner The address that will own the newly created pool.
     */
    function createPool(uint128 requestedPoolId, address owner) external;
}