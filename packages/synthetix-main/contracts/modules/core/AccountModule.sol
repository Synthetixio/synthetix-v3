//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../../interfaces/IAccountModule.sol";
import "../../storage/AccountModuleStorage.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";

contract AccountModule is IAccountModule, OwnableMixin, AccountRBACMixin, AssociatedSystemsMixin {
    bytes32 private constant _ACCOUNT_SYSTEM = "accountNft";

    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;

    error OnlyTokenProxyAllowed(address origin);
    error InvalidRole();

    function getAccountAddress() public view override returns (INftModule) {
        return _getNft(_ACCOUNT_SYSTEM);
    }

    function getAccountPermissions(uint accountId) external view returns (AccountPermission[] memory permissions) {
        AccountRBAC storage accountRbac = _accountModuleStore().accountsRBAC[accountId];

        uint allPermissionsLength = accountRbac.permissionAddresses.length();
        permissions = new AccountPermission[](allPermissionsLength);
        for (uint i = 1; i < allPermissionsLength; i++) {
            address permissionAddress = accountRbac.permissionAddresses.valueAt(i);
            permissions[i - 1] = AccountPermission({
                target: permissionAddress,
                roles: accountRbac.permissions[permissionAddress].values()
            });
        }
    }

    // ---------------------------------------
    // Business Logic
    // ---------------------------------------
    function createAccount(uint256 accountId) external override {
        getAccountAddress().mint(msg.sender, accountId);

        _accountModuleStore().accountsRBAC[accountId].owner = msg.sender;
    }

    function hasRole(
        uint256 accountId,
        bytes32 role,
        address target
    ) public view override returns (bool) {
        return _hasRole(accountId, role, target);
    }

    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override onlyRoleAuthorized(accountId, "modifyPermission") {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (role == "") {
            revert InvalidRole();
        }

        AccountRBAC storage accountRbac = _accountModuleStore().accountsRBAC[accountId];

        if (!accountRbac.permissionAddresses.contains(target)) {
            accountRbac.permissionAddresses.add(target);
        }

        accountRbac.permissions[target].add(role);

        emit RoleGranted(accountId, role, target, msg.sender);
    }

    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override onlyRoleAuthorized(accountId, "modifyPermission") {
        _revokeRole(accountId, role, target);
    }

    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external override {
        if (msg.sender != target) {
            revert RoleNotAuthorized(accountId, "renounceRole", target);
        }

        _revokeRole(accountId, role, target);
    }

    function _revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) internal {
        AccountRBAC storage accountData = _accountModuleStore().accountsRBAC[accountId];

        accountData.permissions[target].remove(role);

        if (accountData.permissions[target].length() == 0) {
            accountData.permissionAddresses.remove(target);
        }

        emit RoleRevoked(accountId, role, target, msg.sender);
    }

    modifier onlyFromTokenProxy() {
        if (msg.sender != address(getAccountAddress())) {
            revert OnlyTokenProxyAllowed(msg.sender);
        }

        _;
    }
}
