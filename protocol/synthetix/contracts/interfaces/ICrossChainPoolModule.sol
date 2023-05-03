//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/FunctionsClientInterface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

import "../storage/MarketConfiguration.sol";

/**
 * @title Module for management of pools which are cross chain capable
 */
interface ICrossChainPoolModule is FunctionsClientInterface, AutomationCompatibleInterface {
    /**
     * @notice Does something
     */
     function createCrossChainPool(uint128 sourcePoolId, uint64 targetChainId) external returns (uint256 gasTokenUsed);

     function _recvCreateCrossChainPool(uint64 srcChainId, uint64 srcPoolId) external;

     function setCrossChainPoolConfiguration(
        uint128 poolId, 
        MarketConfiguration.Data[][] memory newMarketConfigurations
    ) external;
}