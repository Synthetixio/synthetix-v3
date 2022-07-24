//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing snxUSD token as a Satellite
interface IAssociatedSystemsModule {
    /// @notice create or initialize a new token
    function initOrUpgradeToken(bytes32 id, string memory name, string memory symbol, uint8 decimals, address impl) external;

    function registerUnmanagedSystem(bytes32 id, address endpoint) external;
}
