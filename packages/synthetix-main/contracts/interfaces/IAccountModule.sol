//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";
import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/// @title Module for managing account token (NFT) and accounts, each account is represented by an NFT
interface IAccountModule is ISatelliteFactory {
    struct AccountPermission {
        address target;
        bytes32[] roles;
    }

    /// @notice gets the AccountToken address.
    function getAccountAddress() external view returns (INftModule);

    function getAccountPermissions(uint accountId) external view returns (AccountPermission[] memory);

    /// @notice creates a new accountToken (NFT)
    function createAccount(uint256 accountId) external;

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
