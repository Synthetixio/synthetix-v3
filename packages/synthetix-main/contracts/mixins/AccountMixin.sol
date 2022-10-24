// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../storage/Account.sol";
import "../storage/AccountRBAC.sol";

/**
 * @title Provides access to AccountRBAC objects and storage.
 */
contract AccountMixin {
    using AccountRBAC for AccountRBAC.Data;

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);

    /**
     * @dev Requires that the given account has the specified permission.
     */
    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }
}
