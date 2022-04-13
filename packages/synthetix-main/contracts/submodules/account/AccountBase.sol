//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "../../storage/AccountStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the AcccountModule
contract AccountBase is ERC721, AccountStorage, InitializableMixin, Ownable {
    // ---------------------------------------
    // Constants
    // ---------------------------------------

    uint16 private constant _PERMISSION_STAKE = 1;
    uint16 private constant _PERMISSION_UNSTAKE = 2;
    uint16 private constant _PERMISSION_MINT = 4;
    uint16 private constant _PERMISSION_BURN = 8;
    uint16 private constant _PERMISSION_CLAIM_REWARDS = 16;
    uint16 private constant _PERMISSION_MANAGE_LOCKING = 32;

    // ---------------------------------------
    // Enums
    // ---------------------------------------

    // ---------------------------------------
    // Errors
    // ---------------------------------------

    error NotAuthorized(uint256 account, address addr, uint16 permission);

    // ---------------------------------------
    // Events
    // ---------------------------------------

    event PermissionGranted(uint256 account, address authorized, uint16 permission);
    event PermissionRevoked(uint256 account, address authorized, uint16 permission);
    event AllPermissionsRevoked(uint256 account, address authorized);

    // ---------------------------------------
    // Helpers
    // ---------------------------------------

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
    }

    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

    function _hasPermission(
        uint256 account,
        address authorized,
        uint16 permission
    ) internal view returns (bool) {
        return _accountStore().accountDelegations[account][authorized] & permission != 0;
    }

    function _grantPermission(
        uint256 account,
        address authorized,
        uint16 permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] |
            permission;
        emit PermissionGranted(account, authorized, permission);
    }

    function _revokePermission(
        uint256 account,
        address authorized,
        uint16 permission
    ) internal {
        _accountStore().accountDelegations[account][authorized] =
            _accountStore().accountDelegations[account][authorized] &
            ~permission;
        emit PermissionRevoked(account, authorized, permission);
    }

    function _clearPermissions(uint256 account, address authorized) internal {
        _accountStore().accountDelegations[account][authorized] = 0;
        emit AllPermissionsRevoked(account, authorized);
    }

    function _setPermissions(
        uint256 account,
        address authorized,
        uint16[] calldata permissions
    ) internal {
        _clearPermissions(account, authorized);
        for (uint i = 0; i < permissions.length; i++) {
            _grantPermission(account, authorized, permissions[i]);
        }
    }

    /// @dev Used to allow certain functions to operate on the account if owner or authorized to that operation
    modifier onlyOwnerOrAuthorized(uint256 accountId, uint16 permission) {
        if (msg.sender != ownerOf(accountId) && !_hasPermission(accountId, msg.sender, permission)) {
            revert NotAuthorized(accountId, msg.sender, permission);
        }

        _;
    }
}
