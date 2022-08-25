//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/AccountModuleStorage.sol";

contract AccountRBACMixin is AccountModuleStorage {
    using SetUtil for SetUtil.Bytes32Set;

    error RoleNotAuthorized(uint accountId, bytes32 role, address target);

    bytes32 internal constant _ROLE_MODIFY = keccak256("MODIFY");
    bytes32 internal constant _ROLE_STAKE = keccak256("STAKE");
    bytes32 internal constant _ROLE_UNSTAKE = keccak256("UNSTAKE");
    bytes32 internal constant _ROLE_ASSIGN = keccak256("ASSIGN");
    bytes32 internal constant _ROLE_MINT = keccak256("MINT");

    modifier onlyRoleAuthorized(uint accountId, bytes32 role) {
        if (!_authorized(accountId, role, msg.sender)) {
            revert RoleNotAuthorized(accountId, role, msg.sender);
        }

        _;
    }

    function _hasRole(
        uint256 accountId,
        bytes32 role,
        address target
    ) internal view returns (bool) {
        AccountRBAC storage accountRBAC = _accountModuleStore().accountsRBAC[accountId];

        return target != address(0) && accountRBAC.permissions[target].contains(role);
    }

    function _authorized(
        uint accountId,
        bytes32 role,
        address target
    ) internal view returns (bool) {
        return ((target == _accountOwner(accountId)) || (_hasRole(accountId, role, target)));
    }

    function _accountOwner(uint accountId) internal view returns (address) {
        return _accountModuleStore().accountsRBAC[accountId].owner;
    }
}
