//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

library AccountRBAC {
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;

    bytes32 internal constant _ADMIN_PERMISSION = "ADMIN";
    bytes32 internal constant _WITHDRAW_PERMISSION = "WITHDRAW";
    bytes32 internal constant _DELEGATE_PERMISSION = "DELEGATE";
    bytes32 internal constant _MINT_PERMISSION = "MINT";
    bytes32 internal constant _REWARDS_PERMISSION = "REWARDS";

    error InvalidPermission();

    struct Data {
        address owner;
        mapping(address => SetUtil.Bytes32Set) permissions;
        SetUtil.AddressSet permissionAddresses;
    }

    function setOwner(Data storage self, address owner) internal {
        self.owner = owner;
    }

    function grantPermission(
        Data storage self,
        bytes32 permission,
        address target
    ) internal {
        if (target == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (permission == "") {
            revert InvalidPermission();
        }

        if (!self.permissionAddresses.contains(target)) {
            self.permissionAddresses.add(target);
        }

        self.permissions[target].add(permission);
    }

    function revokePermission(
        Data storage self,
        bytes32 permission,
        address target
    ) internal {
        self.permissions[target].remove(permission);

        if (self.permissions[target].length() == 0) {
            self.permissionAddresses.remove(target);
        }
    }

    function revokeAllPermissions(Data storage self, address user) internal {
        bytes32[] memory permissions = self.permissions[user].values();

        for (uint i = 1; i <= permissions.length; i++) {
            revokePermission(self, permissions[i - 1], user);
        }
    }

    function hasPermission(
        Data storage self,
        bytes32 permission,
        address target
    ) internal view returns (bool) {
        return target != address(0) && self.permissions[target].contains(permission);
    }

    function authorized(
        Data storage self,
        bytes32 permission,
        address target
    ) internal view returns (bool) {
        return ((target == self.owner) ||
            hasPermission(self, _ADMIN_PERMISSION, target) ||
            hasPermission(self, permission, target));
    }
}
