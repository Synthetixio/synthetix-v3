//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../interfaces/IAccountModule.sol";
import "../submodules/account/AccountBase.sol";

contract AccountModule is IAccountModule, AccountBase, OwnableMixin {
    using SetUtil for SetUtil.AddressSet;

    function isAccountModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeAccountModule(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external override onlyOwner onlyIfNotInitialized {
        _initialize(tokenName, tokenSymbol, uri);

        AccountStore storage store = _accountStore();

        store.initialized = true;
    }

    function delegateAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _grantPermission(account, authorized, permission);
    }

    function revokeAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _revokePermission(account, authorized, permission);
    }

    function getAccountDelegatedAddresses(uint256 account) external view returns (address[] memory) {
        return _accountStore().delegatedAddresses[account].values();
    }

    function getAccountDelegatedAddressPackedPermissions(uint256 account, address authorized)
        external
        view
        returns (uint32)
    {
        return _accountStore().delegatedPermissions[account][authorized];
    }
}
