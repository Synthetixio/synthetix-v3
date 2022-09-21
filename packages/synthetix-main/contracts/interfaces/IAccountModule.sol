//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing account token (NFT) and accounts, each account is represented by an NFT
interface IAccountModule {
    /**
     * @notice Emitted when an account token with id `accountId` is minted to `sender`.
     */
    event AccountCreated(address indexed sender, uint128 indexed accountId);

    /**
     * @notice Emitted when `target` is granted `permission` by `sender` for account `accountId`.
     */
    event PermissionGranted(uint128 indexed accountId, bytes32 indexed permission, address indexed target, address sender);

    /**
     * @notice Emitted when `target` has `permission` renounced or revoked by `sender` for account `accountId`.
     */
    event PermissionRevoked(uint128 indexed accountId, bytes32 indexed permission, address indexed target, address sender);

    struct AccountPermissions {
        address target;
        bytes32[] permissions;
    }

    /**
     * @notice Returns an array of `AccountPermission` for the provided `accountId`.
     */
    function getAccountPermissions(uint128 accountId) external view returns (AccountPermissions[] memory);

    /**
     * @notice Mints an account token with id `requestedAccountId` to `msg.sender`.
     *
     * Requirements:
     *
     * - `requestedAccountId` must not already be minted.
     *
     * Emits a {AccountCreated} event.
     */
    function createAccount(uint128 requestedAccountId) external;

    /**
     * @notice Grants `permission` to `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the account token.
     */
    function notifyAccountTransfer(address to, uint256 accountId) external;

    /**
     * @notice Grants `permission` to `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionGranted} event.
     */
    function grantPermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external;

    /**
     * @notice Revokes `permission` from `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionRevoked} event.
     */
    function revokePermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external;

    /**
     * @notice Revokes `permission` from `msg.sender` for account `accountId`.
     *
     * Emits a {PermissionRevoked} event.
     */
    function renouncePermission(uint128 accountId, bytes32 permission) external;

    /**
     * @notice Returns `true` if `target` has been granted `permission` for account `accountId`.
     */
    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external view returns (bool);

    /**
     * @notice Returns the address for the account token used by the module.
     */
    function getAccountTokenAddress() external view returns (address);

    /**
     * @notice Returns the address that owns a given account, as recorded by the system.
     */
    function getAccountOwner(uint128 accountId) external view returns (address);
}
