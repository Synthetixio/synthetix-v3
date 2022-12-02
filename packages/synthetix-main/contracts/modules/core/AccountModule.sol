//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "../../interfaces/IAccountModule.sol";
import "../../interfaces/IAccountTokenModule.sol";
import "../../storage/Account.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

/**
 * @title System module for managing accounts
 */
contract AccountModule is IAccountModule {
    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    using AccountRBAC for AccountRBAC.Data;
    using Account for Account.Data;

    error OnlyAccountTokenProxy(address origin);
    error PermissionNotGranted(uint128 accountId, bytes32 permission, address user);
    error InvalidPermission(bytes32 permission);

    /**
     * @dev Returns the address of the account token
     */
    function getAccountTokenAddress() public view override returns (address) {
        return AssociatedSystem.load(_ACCOUNT_SYSTEM).proxy;
    }

    /**
     * @dev Returns the users and their corresponding permissions on the specified account
     */
    function getAccountPermissions(uint128 accountId) external view returns (AccountPermissions[] memory permissions) {
        AccountRBAC.Data storage accountRbac = Account.load(accountId).rbac;

        uint allPermissionsLength = accountRbac.permissionAddresses.length();
        permissions = new AccountPermissions[](allPermissionsLength);
        for (uint i = 1; i <= allPermissionsLength; i++) {
            address permissionAddress = accountRbac.permissionAddresses.valueAt(i);
            permissions[i - 1] = AccountPermissions({
                user: permissionAddress,
                permissions: accountRbac.permissions[permissionAddress].values()
            });
        }
    }

    /**
     * @dev Creates an account with the requestedAccountId, minting an account token to the sender
     */
    function createAccount(uint128 requestedAccountId) external override {
        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());
        accountTokenModule.mint(msg.sender, requestedAccountId);

        Account.create(requestedAccountId, msg.sender);

        emit AccountCreated(msg.sender, requestedAccountId);
    }

    /**
     * @dev Called by AccountTokenModule to update storage with the new owner when the account token is transferred
     */
    function notifyAccountTransfer(address to, uint128 accountId) external override {
        _onlyAccountToken();

        Account.Data storage account = Account.load(accountId);

        account.rbac.revokeAllPermissions(account.rbac.owner);
        account.rbac.setOwner(to);
    }

    /**
     * @dev Returns whether an account grants the specified user a particular permission
     */
    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.hasPermission(permission, user);
    }

    /**
     * @dev Returns whether a user is granted a specified permission, is an admin, or is the owner
     */
    function isAuthorized(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.authorized(permission, user);
    }

    /**
     * @dev Allows an account admin to grant a specified permission to a user
     */
    function grantPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override {
        _isPermissionValid(permission);

        Account.onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION);

        Account.load(accountId).rbac.grantPermission(permission, user);

        emit PermissionGranted(accountId, permission, user, msg.sender);
    }

    /**
     * @dev Allows an account admin to revoke a specified permission to a user
     */
    function revokePermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override {
        Account.onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION);

        Account.load(accountId).rbac.revokePermission(permission, user);

        emit PermissionRevoked(accountId, permission, user, msg.sender);
    }

    /**
     * @dev Allows a user to renounce a permission on a specified account
     */
    function renouncePermission(uint128 accountId, bytes32 permission) external override {
        if (!Account.load(accountId).rbac.hasPermission(permission, msg.sender)) {
            revert PermissionNotGranted(accountId, permission, msg.sender);
        }

        Account.load(accountId).rbac.revokePermission(permission, msg.sender);

        emit PermissionRevoked(accountId, permission, msg.sender, msg.sender);
    }

    /**
     * @dev Returns the owner of an account
     */
    function getAccountOwner(uint128 accountId) public view returns (address) {
        return Account.load(accountId).rbac.owner;
    }

    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _onlyAccountToken() internal {
        if (msg.sender != address(getAccountTokenAddress())) {
            revert OnlyAccountTokenProxy(msg.sender);
        }
    }

    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _isPermissionValid(bytes32 permission) internal {
        if (
            permission != AccountRBAC._WITHDRAW_PERMISSION &&
            permission != AccountRBAC._DELEGATE_PERMISSION &&
            permission != AccountRBAC._MINT_PERMISSION &&
            permission != AccountRBAC._ADMIN_PERMISSION
        ) {
            revert InvalidPermission(permission);
        }
    }
}
