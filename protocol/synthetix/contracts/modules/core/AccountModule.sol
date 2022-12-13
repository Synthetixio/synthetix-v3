//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../interfaces/IAccountModule.sol";
import "../../interfaces/IAccountTokenModule.sol";
import "../../storage/Account.sol";

/**
 * @title Module for managing accounts.
 * @dev See IAccountModule.
 */
contract AccountModule is IAccountModule {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using AccountRBAC for AccountRBAC.Data;
    using Account for Account.Data;

    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountTokenAddress() public view override returns (address) {
        return AssociatedSystem.load(_ACCOUNT_SYSTEM).proxy;
    }

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountPermissions(
        uint128 accountId
    ) external view returns (AccountPermissions[] memory permissions) {
        AccountRBAC.Data storage accountRbac = Account.load(accountId).rbac;

        uint256 allPermissionsLength = accountRbac.permissionAddresses.length();
        permissions = new AccountPermissions[](allPermissionsLength);
        for (uint256 i = 1; i <= allPermissionsLength; i++) {
            address permissionAddress = accountRbac.permissionAddresses.valueAt(i);
            permissions[i - 1] = AccountPermissions({
                user: permissionAddress,
                permissions: accountRbac.permissions[permissionAddress].values()
            });
        }
    }

    /**
     * @inheritdoc IAccountModule
     */
    function createAccount(uint128 requestedAccountId) external override {
        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());
        accountTokenModule.mint(msg.sender, requestedAccountId);

        Account.create(requestedAccountId, msg.sender);

        emit AccountCreated(requestedAccountId, msg.sender);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function notifyAccountTransfer(address to, uint128 accountId) external override {
        _onlyAccountToken();

        Account.Data storage account = Account.load(accountId);

        account.rbac.revokeAllPermissions(account.rbac.owner);
        account.rbac.setOwner(to);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.hasPermission(permission, user);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function isAuthorized(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.authorized(permission, user);
    }

    /**
     * @inheritdoc IAccountModule
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
     * @inheritdoc IAccountModule
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
     * @inheritdoc IAccountModule
     */
    function renouncePermission(uint128 accountId, bytes32 permission) external override {
        if (!Account.load(accountId).rbac.hasPermission(permission, msg.sender)) {
            revert PermissionNotGranted(accountId, permission, msg.sender);
        }

        Account.load(accountId).rbac.revokePermission(permission, msg.sender);

        emit PermissionRevoked(accountId, permission, msg.sender, msg.sender);
    }

    /**
     * @inheritdoc IAccountModule
     */
    function getAccountOwner(uint128 accountId) public view returns (address) {
        return Account.load(accountId).rbac.owner;
    }

    /**
     * @dev Reverts if the caller is not the account token managed by this module.
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _onlyAccountToken() internal {
        if (msg.sender != address(getAccountTokenAddress())) {
            revert OnlyAccountTokenProxy(msg.sender);
        }
    }

    /**
     * @dev Reverts if the specified permission is unknown to the account RBAC system.
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _isPermissionValid(bytes32 permission) internal {
        if (
            permission != AccountRBAC._WITHDRAW_PERMISSION &&
            permission != AccountRBAC._DELEGATE_PERMISSION &&
            permission != AccountRBAC._MINT_PERMISSION &&
            permission != AccountRBAC._ADMIN_PERMISSION
        ) {
            revert Account.InvalidPermission(permission);
        }
    }
}
