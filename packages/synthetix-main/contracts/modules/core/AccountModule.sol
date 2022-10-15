//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "../../interfaces/IAccountModule.sol";
import "../../interfaces/IAccountTokenModule.sol";
import "../../storage/Account.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

contract AccountModule is IAccountModule, OwnableMixin, AssociatedSystemsMixin {
    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    using AccountRBAC for AccountRBAC.Data;
    using Account for Account.Data;

    error OnlyAccountTokenProxy(address origin);

    error PermissionDenied(uint128 accountId, bytes32 permission, address user);

    error PermissionNotGranted(uint128 accountId, bytes32 permission, address user);

    error InvalidPermission(bytes32 permission);

    modifier onlyAccountToken() {
        if (msg.sender != address(getAccountTokenAddress())) {
            revert OnlyAccountTokenProxy(msg.sender);
        }

        _;
    }

    function getAccountTokenAddress() public view override returns (address) {
        return _getSystemAddress(_ACCOUNT_SYSTEM);
    }

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

    // ---------------------------------------
    // Business Logic
    // ---------------------------------------
    function createAccount(uint128 requestedAccountId) external override {
        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());
        accountTokenModule.mint(msg.sender, requestedAccountId);

        Account.create(requestedAccountId, msg.sender);

        emit AccountCreated(msg.sender, requestedAccountId);
    }

    function notifyAccountTransfer(address to, uint128 accountId) external override onlyAccountToken {
        Account.Data storage account = Account.load(accountId);

        account.rbac.revokeAllPermissions(account.rbac.owner);
        account.rbac.setOwner(to);
    }

    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.hasPermission(permission, user);
    }

    function isAuthorized(
        uint128 accountId,
        bytes32 permission,
        address user
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.authorized(permission, user);
    }

    function grantPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION) isPermissionValid(permission) {
        Account.load(accountId).rbac.grantPermission(permission, user);

        emit PermissionGranted(accountId, permission, user, msg.sender);
    }

    function revokePermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external override onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION) {
        Account.load(accountId).rbac.revokePermission(permission, user);

        emit PermissionRevoked(accountId, permission, user, msg.sender);
    }

    function renouncePermission(uint128 accountId, bytes32 permission) external override {
        if (!Account.load(accountId).rbac.hasPermission(permission, msg.sender)) {
            revert PermissionNotGranted(accountId, permission, msg.sender);
        }

        Account.load(accountId).rbac.revokePermission(permission, msg.sender);

        emit PermissionRevoked(accountId, permission, msg.sender, msg.sender);
    }

    function getAccountOwner(uint128 accountId) public view returns (address) {
        return Account.load(accountId).rbac.owner;
    }

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!_authorized(accountId, permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    modifier isPermissionValid(bytes32 permission) {
        if (
            permission != AccountRBAC._DEPOSIT_PERMISSION &&
            permission != AccountRBAC._WITHDRAW_PERMISSION &&
            permission != AccountRBAC._DELEGATE_PERMISSION &&
            permission != AccountRBAC._MINT_PERMISSION &&
            permission != AccountRBAC._ADMIN_PERMISSION
        ) {
            revert InvalidPermission(permission);
        }

        _;
    }

    function _authorized(
        uint128 accountId,
        bytes32 permission,
        address user
    ) internal view returns (bool) {
        return ((user == getAccountOwner(accountId)) ||
            Account.load(accountId).rbac.hasPermission(AccountRBAC._ADMIN_PERMISSION, user) ||
            Account.load(accountId).rbac.hasPermission(permission, user));
    }
}
