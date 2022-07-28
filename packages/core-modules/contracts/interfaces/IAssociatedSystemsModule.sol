//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Allows for the registration and tracking of auxillery contracts which also follow the proxy architecture
interface IAssociatedSystemsModule {
    /// @notice create or initialize a new token
    function initOrUpgradeToken(
        bytes32 id,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address impl
    ) external;

    function initOrUpgradeNft(
        bytes32 id,
        string memory name,
        string memory symbol,
        string memory uri,
        address impl
    ) external;

    function registerUnmanagedSystem(bytes32 id, address endpoint) external;

    function getAssociatedSystem(bytes32 id) external view returns (address proxy, bytes32 kind);
}
