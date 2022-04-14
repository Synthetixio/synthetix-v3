//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "../interfaces/IAccount.sol";

import "./account/AccountBase.sol";

contract Account is IAccount, AccountBase, UUPSImplementation, Ownable {
    using SetUtil for SetUtil.AddressSet;

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function delegateAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external override onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _grantPermission(account, authorized, permission);
    }

    function revokeAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external override onlyOwnerOrAuthorized(account, Permission.Delegate) {
        _revokePermission(account, authorized, permission);
    }

    function getAccountDelegatedAddresses(uint256 account) external view override returns (address[] memory) {
        return _accountStore().delegatedAddresses[account].values();
    }

    function getAccountDelegatedAddressPackedPermissions(uint256 account, address authorized)
        external
        view
        override
        returns (uint32)
    {
        return _accountStore().delegatedPermissions[account][authorized];
    }
}
