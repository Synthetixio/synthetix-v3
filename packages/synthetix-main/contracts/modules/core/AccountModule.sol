//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "../../interfaces/IAccountModule.sol";
import "../../interfaces/IAccountTokenModule.sol";
import "../../storage/AccountModuleStorage.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountRBACMixin, AssociatedSystemsMixin {
    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    error OnlyAccountTokenProxy(address origin);
    error InvalidPermission();
    error PermissionNotGranted(uint accountId, bytes32 permission, address target);

    modifier onlyAccountToken() {
        if (msg.sender != address(getAccountTokenAddress())) {
            revert OnlyAccountTokenProxy(msg.sender);
        }

        _;
    }

    function getAccountTokenAddress() public view override returns (address) {
        return _getSystemAddress(_ACCOUNT_SYSTEM);
    }

    function getAccountPermissions(uint accountId) external view returns (AccountPermissions[] memory permissions) {
        AccountRBAC storage accountRbac = _accountModuleStore().accountsRBAC[accountId];

        uint allPermissionsLength = accountRbac.permissionAddresses.length();
        permissions = new AccountPermissions[](allPermissionsLength);
        for (uint i = 1; i < allPermissionsLength; i++) {
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
    function createAccount(uint256 requestedAccountId) external override {
        IAccountTokenModule accountTokenModule = IAccountTokenModule(getAccountTokenAddress());
        accountTokenModule.mint(msg.sender, requestedAccountId);

        _accountModuleStore().accountsRBAC[requestedAccountId].owner = msg.sender;

        emit AccountCreated(msg.sender, requestedAccountId);
    }

    function notifyAccountTransfer(address to, uint256 accountId) external override onlyAccountToken {
        _accountModuleStore().accountsRBAC[accountId].owner = to;
    }

    function hasPermission(
        uint256 accountId,
        bytes32 permission,
        address target
    ) public view override returns (bool) {
        return _hasPermission(accountId, permission, target);
    }

    function grantPermission(
        uint accountId,
        bytes32 permission,
        address target
    ) external override onlyWithPermission(accountId, _ADMIN_PERMISSION) {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (permission == "") {
            revert InvalidPermission();
        }

        AccountRBAC storage accountRbac = _accountModuleStore().accountsRBAC[accountId];

        if (!accountRbac.permissionAddresses.contains(target)) {
            accountRbac.permissionAddresses.add(target);
        }

        accountRbac.permissions[target].add(permission);

        emit PermissionGranted(accountId, permission, target, msg.sender);
    }

    function revokePermission(
        uint accountId,
        bytes32 permission,
        address target
    ) external override onlyWithPermission(accountId, _ADMIN_PERMISSION) {
        _revokePermission(accountId, permission, target);
    }

    function renouncePermission(uint accountId, bytes32 permission) external override {
        _revokePermission(accountId, permission, msg.sender);
    }

    function _revokePermission(
        uint accountId,
        bytes32 permission,
        address target
    ) internal {
        AccountRBAC storage accountData = _accountModuleStore().accountsRBAC[accountId];

        if (!_hasPermission(accountId, permission, target)) {
            revert PermissionNotGranted(accountId, permission, target);
        }

        accountData.permissions[target].remove(permission);

        if (accountData.permissions[target].length() == 0) {
            accountData.permissionAddresses.remove(target);
        }

        emit PermissionRevoked(accountId, permission, target, msg.sender);
    }

    function getAccountOwner(uint accountId) external view returns (address) {
        return _accountOwner(accountId);
    }
}
