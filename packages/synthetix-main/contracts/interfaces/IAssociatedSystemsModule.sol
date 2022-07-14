//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing snxUSD token as a Satellite
interface IAssociatedSystemsModule {
    /// @notice create or initialize a new token
    function initOrUpgradeToken(string memory name, string memory symbol, uint decimals, address impl) external;
}
