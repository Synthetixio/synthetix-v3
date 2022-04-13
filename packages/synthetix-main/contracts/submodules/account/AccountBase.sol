//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../../storage/AccountStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the AcccountModule
contract AccountBase is ERC721, AccountStorage, InitializableMixin {
    // ---------------------------------------
    // Enums
    // ---------------------------------------
    enum Permission {
        Owner, // Actually, is not needed as a permission itself, but is a placeholder for onlyOwner operations
        Stake,
        Unstake,
        Mint,
        Burn,
        ClaimRewards,
        ManageLocking,
        Delegate
    }

    // ---------------------------------------
    // Errors
    // ---------------------------------------

    error NotAuthorized(uint256 account, address addr, Permission permission);

    // ---------------------------------------
    // Events
    // ---------------------------------------

    event PermissionGranted(uint256 account, address authorized, Permission permission);
    event PermissionRevoked(uint256 account, address authorized, Permission permission);
    event PermissionsSet(uint256 account, address authorized, uint32 packedPermissions);
    event PermissionsCleared(uint256 account, address authorized);

    // ---------------------------------------
    // Helpers
    // ---------------------------------------

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

    function _getPermissionMask(Permission permission) internal pure returns (uint32) {
        return uint32(1) << uint32(permission);
    }

    function _hasPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) internal view returns (bool) {
        return _accountStore().accountDelegations[account][authorized] & _getPermissionMask(permission) != 0;
    }

    function _grantPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] |
            _getPermissionMask(permission);

        emit PermissionGranted(account, authorized, permission);
    }

    function _revokePermission(
        uint256 account,
        address authorized,
        Permission permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] &
            ~_getPermissionMask(permission);

        emit PermissionRevoked(account, authorized, permission);
    }

    function _clearPermissions(uint256 account, address authorized) internal {
        _accountStore().accountDelegations[account][authorized] = 0;

        emit PermissionsCleared(account, authorized);
    }

    function _setPermissions(
        uint256 account,
        address authorized,
        Permission[] calldata permissions
    ) internal {
        uint32 packedPermissions = 0;

        for (uint i = 0; i < permissions.length; i++) {
            packedPermissions = packedPermissions | _getPermissionMask(permissions[i]);
        }

        _accountStore().accountDelegations[account][authorized] = packedPermissions;

        emit PermissionsSet(account, authorized, packedPermissions);
    }

    /// @dev Used to allow certain functions to operate on the account if owner or authorized to that operation
    modifier onlyOwnerOrAuthorized(uint256 accountId, Permission permission) {
        if (msg.sender != ownerOf(accountId) && !_hasPermission(accountId, msg.sender, permission)) {
            revert NotAuthorized(accountId, msg.sender, permission);
        }

        _;
    }
}
