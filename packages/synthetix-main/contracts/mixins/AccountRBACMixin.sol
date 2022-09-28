//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/AccountModuleStorage.sol";

contract AccountRBACMixin is AccountModuleStorage {
    using SetUtil for SetUtil.Bytes32Set;

    error PermissionDenied(uint accountId, bytes32 permission, address user);
    error InvalidPermission(bytes32 permission);

    bytes32 internal constant _DEPOSIT_PERMISSION = "DEPOSIT";
    bytes32 internal constant _WITHDRAW_PERMISSION = "WITHDRAW";
    bytes32 internal constant _DELEGATE_PERMISSION = "DELEGATE";
    bytes32 internal constant _MINT_PERMISSION = "MINT";
    bytes32 internal constant _ADMIN_PERMISSION = "ADMIN";

    modifier onlyWithPermission(uint accountId, bytes32 permission) {
        if (!_authorized(accountId, permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    modifier isPermissionValid(bytes32 permission) {
        if (
            permission != _DEPOSIT_PERMISSION &&
            permission != _WITHDRAW_PERMISSION &&
            permission != _DELEGATE_PERMISSION &&
            permission != _MINT_PERMISSION &&
            permission != _ADMIN_PERMISSION
        ) {
            revert InvalidPermission(permission);
        }

        _;
    }

    function _hasPermission(
        uint256 accountId,
        bytes32 permission,
        address user
    ) internal view returns (bool) {
        AccountRBAC storage accountRBAC = _accountModuleStore().accountsRBAC[accountId];

        return user != address(0) && accountRBAC.permissions[user].contains(permission);
    }

    function _authorized(
        uint accountId,
        bytes32 permission,
        address user
    ) internal view returns (bool) {
        return ((user == _accountOwner(accountId)) ||
            _hasPermission(accountId, _ADMIN_PERMISSION, user) ||
            _hasPermission(accountId, permission, user));
    }

    function _accountOwner(uint accountId) internal view returns (address) {
        return _accountModuleStore().accountsRBAC[accountId].owner;
    }
}
