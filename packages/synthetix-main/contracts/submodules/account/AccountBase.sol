//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../../storage/AccountStorage.sol";
import "../../interfaces/IAccountDelegation.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the AcccountModule
contract AccountBase is ERC721, AccountStorage, IAccountDelegation, InitializableMixin {
    using SetUtil for SetUtil.AddressSet;

    // ---------------------------------------
    // Enums
    // ---------------------------------------

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
        return _accountStore().delegatedPermissions[account][authorized] & _getPermissionMask(permission) != 0;
    }

    function _grantPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) internal {
        _accountStore().delegatedPermissions[account][authorized] =
            _accountStore().delegatedPermissions[account][authorized] |
            _getPermissionMask(permission);

        if (!_accountStore().delegatedAddresses[account].contains(authorized)) {
            _accountStore().delegatedAddresses[account].add(authorized);
        }

        emit PermissionGranted(account, authorized, permission);
    }

    function _revokePermission(
        uint256 account,
        address authorized,
        Permission permission
    ) internal {
        _accountStore().delegatedPermissions[account][authorized] =
            _accountStore().delegatedPermissions[account][authorized] &
            ~_getPermissionMask(permission);

        if (_accountStore().delegatedPermissions[account][authorized] == 0) {
            _accountStore().delegatedAddresses[account].remove(authorized);
        }

        emit PermissionRevoked(account, authorized, permission);
    }

    function _clearPermissions(uint256 account, address authorized) internal {
        _accountStore().delegatedPermissions[account][authorized] = 0;

        _accountStore().delegatedAddresses[account].remove(authorized);

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

        _accountStore().delegatedPermissions[account][authorized] = packedPermissions;

        if (!_accountStore().delegatedAddresses[account].contains(authorized)) {
            _accountStore().delegatedAddresses[account].add(authorized);
        }

        emit PermissionsSet(account, authorized, packedPermissions);
    }

    /// @dev Used to allow certain functions to operate on the account if owner or authorized to that operation
    modifier onlyOwnerOrAuthorized(uint256 accountId, Permission permission) {
        if (
            msg.sender != ownerOf(accountId) &&
            !_hasPermission(accountId, msg.sender, Permission.Owner) &&
            !_hasPermission(accountId, msg.sender, permission)
        ) {
            revert NotAuthorized(accountId, msg.sender, permission);
        }

        _;
    }
}
