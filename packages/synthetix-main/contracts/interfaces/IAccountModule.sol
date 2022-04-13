//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAccountDelegation.sol";

interface IAccountModule is IAccountDelegation {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeAccountModule(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external;

    function isAccountModuleInitialized() external view returns (bool);

    // ---------------------------------------
    // Delegation
    // ---------------------------------------

    function delegateAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external;

    function revokeAccountPermission(
        uint256 account,
        address authorized,
        Permission permission
    ) external;

    function getAccountDelegatedAddresses(uint256 account) external view returns (address[] memory);

    function getAccountDelegatedAddressPackedPermissions(uint256 account, address authorized) external view returns (uint32);
}
