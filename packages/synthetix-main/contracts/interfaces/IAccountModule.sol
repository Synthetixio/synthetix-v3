//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

/// @title Module for managing account token (NFT) and accounts, each account is represented by an NFT
interface IAccountModule is ISatelliteFactory {
    /// @notice initializes the Account Module. Creates the AccountToken proxy and first implementation.
    function initializeAccountModule() external;

    /// @notice shows whether the module has been initialized
    function isAccountModuleInitialized() external view returns (bool);

    /// @notice upgrades the AccountToken implementation.
    function upgradeAccountImplementation(address newAccountImplementation) external;

    /// @notice gets the AccountToken address.
    function getAccountAddress() external view returns (address);

    /// @notice gets the AccountModule Satellites created (only one, at idx 0).
    function getAccountModuleSatellites() external view returns (Satellite[] memory);

    /// @notice creates a new accountToken (NFT)
    function mintAccount(uint256 accountId) external; // TODO change to createAccount

    /// @notice creates a new accountToken (NFT)
    function transferAccount(address to, uint256 accountId) external;

    /// @notice grants "target" address the "role" role for the "accountId" account token NFT
    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    /// @notice revokes "target" address the "role" role for the "accountId" account token NFT
    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    /// @notice the sender (must be the same as "target") renounces to the "role" role for the "accountId" account token NFT
    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    /// @notice checks if the "target" address has the "role" role granted for the "accountId" account token NFT
    function hasRole(
        uint accountId,
        bytes32 role,
        address target
    ) external view returns (bool);
}
