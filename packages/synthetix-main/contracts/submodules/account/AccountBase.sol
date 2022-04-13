//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../../storage/AccountStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the AcccountModule
contract AccountBase is ERC721, AccountStorage, InitializableMixin {
    // ---------------------------------------
    // Constants
    // ---------------------------------------

    /// @dev use permissions packed in an uint32 (16 permissions). Set the values right shifting uint(1) from 0 to 15
    uint32 private constant _PERMISSION_OWNER = uint32(1); // Actually, is not needed as a permission itself, but is a placeholder for onlyOwner operations
    uint32 private constant _PERMISSION_STAKE = uint32(1) << 1;
    uint32 private constant _PERMISSION_UNSTAKE = uint32(1) << 2;
    uint32 private constant _PERMISSION_MINT = uint32(1) << 3;
    uint32 private constant _PERMISSION_BURN = uint32(1) << 4;
    uint32 private constant _PERMISSION_CLAIM_REWARDS = uint32(1) << 5;
    uint32 private constant _PERMISSION_MANAGE_LOCKING = uint32(1) << 6;
    uint32 private constant _PERMISSION_DELEGATE = uint32(1) << 7;

    // ---------------------------------------
    // Enums
    // ---------------------------------------

    // ---------------------------------------
    // Errors
    // ---------------------------------------

    error NotAuthorized(uint256 account, address addr, uint32 permission);

    // ---------------------------------------
    // Events
    // ---------------------------------------

    event PermissionGranted(uint256 account, address authorized, uint32 permission);
    event PermissionRevoked(uint256 account, address authorized, uint32 permission);
    event PermissionsSet(uint256 account, address authorized, uint32 packedPermissions);
    event PermissionsCleared(uint256 account, address authorized);

    // ---------------------------------------
    // Helpers
    // ---------------------------------------

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

    function _hasPermission(
        uint256 account,
        address authorized,
        uint32 permission
    ) internal view returns (bool) {
        return _accountStore().accountDelegations[account][authorized] & permission != 0;
    }

    function _grantPermission(
        uint256 account,
        address authorized,
        uint32 permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] |
            permission;

        emit PermissionGranted(account, authorized, permission);
    }

    function _revokePermission(
        uint256 account,
        address authorized,
        uint32 permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] &
            ~permission;

        emit PermissionRevoked(account, authorized, permission);
    }

    function _clearPermissions(uint256 account, address authorized) internal {
        _accountStore().accountDelegations[account][authorized] = 0;

        emit PermissionsCleared(account, authorized);
    }

    function _setPermissions(
        uint256 account,
        address authorized,
        uint32[] calldata permissions
    ) internal {
        uint32 packedPermissions = 0;

        for (uint i = 0; i < permissions.length; i++) {
            packedPermissions = packedPermissions | permissions[i];
        }

        _accountStore().accountDelegations[account][authorized] = packedPermissions;

        emit PermissionsSet(account, authorized, packedPermissions);
    }

    /// @dev Used to allow certain functions to operate on the account if owner or authorized to that operation
    modifier onlyOwnerOrAuthorized(uint256 accountId, uint32 permission) {
        if (msg.sender != ownerOf(accountId) && !_hasPermission(accountId, msg.sender, permission)) {
            revert NotAuthorized(accountId, msg.sender, permission);
        }

        _;
    }
}
