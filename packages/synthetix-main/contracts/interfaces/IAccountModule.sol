//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing account token (NFT) and accounts, each account is represented by an NFT
interface IAccountModule {
    /**
     * @dev Emitted when an account token with id `accountId` is minted to `sender`.
     */
    event AccountCreated(address indexed sender, uint indexed accountId);

    /**
     * @dev Emitted when `target` is granted `permission` by `sender` for account `accountId`.
     */
    event PermissionGranted(uint indexed accountId, bytes32 indexed permission, address indexed target, address sender);

    /**
     * @dev Emitted when `target` has `permission` renounced or revoked by `sender` for account `accountId`.
     */
    event PermissionRevoked(uint indexed accountId, bytes32 indexed permission, address indexed target, address sender);

    struct AccountPermissions {
        address target;
        bytes32[] permissions;
    }

    /**
     * @dev Returns an array of `AccountPermissions` for the provided `accountId`.
     */
    function getAccountPermissions(uint accountId) external view returns (AccountPermissions[] memory);

    /**
     * @dev Mints an account token with id `requestedAccountId` to `msg.sender`.
     *
     * Requirements:
     *
     * - `requestedAccountId` must not already be minted.
     *
     * Emits a {AccountCreated} event.
     */
    function createAccount(uint256 requestedAccountId) external;

    /**
     * @dev Allows the account token to notify the system when a transfer has occurred
     *
     * Requirements:
     *
     * - `msg.sender` must be the account token.
     */
    function notifyAccountTransfer(address to, uint256 accountId) external;

    /**
     * @dev Grants `permission` to `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionGranted} event.
     */
    function grantPermission(
        uint accountId,
        bytes32 permission,
        address target
    ) external;

    /**
     * @dev Revokes `permission` from `target` for account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionRevoked} event.
     */
    function revokePermission(
        uint accountId,
        bytes32 permission,
        address target
    ) external;

    /**
     * @dev Revokes `permission` from `msg.sender` for account `accountId`.
     *
     * Emits a {PermissionRevoked} event.
     */
    function renouncePermission(uint accountId, bytes32 permission) external;

    /**
     * @dev Returns `true` if `target` has been granted `permission` for account `accountId`.
     */
    function hasPermission(
        uint accountId,
        bytes32 permission,
        address target
    ) external view returns (bool);

    /**
     * @dev Returns the address for the account token used by the module.
     */
    function getAccountTokenAddress() external view returns (address);

    /**
     * @dev Returns the address that owns a given account, as recorded by the system.
     */
    function accountOwner(uint accountId) external view returns (address);
}
