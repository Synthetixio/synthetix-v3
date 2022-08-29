//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing account token (NFT) and accounts, each account is represented by an NFT
interface IAccountModule {
    /**
     * @notice Emitted when an account token with id `accountId` is minted to `sender`.
     */
    event AccountCreated(address indexed sender, uint indexed accountId);

    /**
     * @notice Emitted when `target` is granted `role` by `sender` for account `accountId`.
     */
    event RoleGranted(uint indexed accountId, bytes32 indexed role, address indexed target, address sender);

    /**
     * @notice Emitted when `target` has `role` renounced or revoked by `sender` for account `accountId`.
     */
    event RoleRevoked(uint indexed accountId, bytes32 indexed role, address indexed target, address sender);

    struct AccountPermission {
        address target;
        bytes32[] roles;
    }

    /**
     * @notice Returns an array of `AccountPermission` for the provided `accountId`.
     */
    function getAccountPermissions(uint accountId) external view returns (AccountPermission[] memory);

    /**
     * @notice Mints an account token with id `requestedAccountId` to `msg.sender`.
     *
     * Requirements:
     *
     * - `requestedAccountId` must not already be minted.
     *
     * Emits a {AccountCreated} event.
     */
    function createAccount(uint256 requestedAccountId) external;

    /**
     * @notice Grants `role` to `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" role.
     *
     * Emits a {RoleGranted} event.
     */
    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    /**
     * @notice Revokes `role` from `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" role.
     *
     * Emits a {RoleRevoked} event.
     */
    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    /**
     * @notice Revokes `role` from `msg.sender` for account `accountId`.
     *
     * Emits a {RoleRevoked} event.
     */
    function renounceRole(uint accountId, bytes32 role) external;

    /**
     * @notice Returns `true` if `target` has been granted `role` for account `accountId`.
     */
    function hasRole(
        uint accountId,
        bytes32 role,
        address target
    ) external view returns (bool);

    /**
     * @notice Returns the address for the account token used by the module.
     */
    function getAccountTokenAddress() external view returns (address);
}
