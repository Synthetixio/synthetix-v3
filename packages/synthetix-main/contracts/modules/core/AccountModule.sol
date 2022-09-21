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

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);

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
                target: permissionAddress,
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

        Account.load(requestedAccountId).rbac.setOwner(msg.sender);

        emit AccountCreated(msg.sender, requestedAccountId);
    }

    function notifyAccountTransfer(address to, uint128 accountId) external override onlyAccountToken {
        Account.load(accountId).rbac.setOwner(to);
    }

    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) public view override returns (bool) {
        return Account.load(accountId).rbac.hasPermission(permission, target);
    }

    function grantPermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external override onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION) {
        Account.load(accountId).rbac.grantPermission(permission, target);

        emit PermissionGranted(accountId, permission, target, msg.sender);
    }

    function revokePermission(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external override onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION) {
        Account.load(accountId).rbac.revokePermission(permission, target);

        emit PermissionRevoked(accountId, permission, target, msg.sender);
    }

    function renouncePermission(uint128 accountId, bytes32 permission) external override {
        Account.load(accountId).rbac.revokePermission(permission, msg.sender);

        emit PermissionRevoked(accountId, permission, msg.sender, msg.sender);
    }

    function getAccountOwner(uint128 accountId) external view returns (address) {
        return Account.load(accountId).rbac.owner;
    }

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }
}
