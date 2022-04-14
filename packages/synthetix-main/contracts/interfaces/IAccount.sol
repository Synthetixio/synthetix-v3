//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IDelegation.sol";

interface IAccount is IDelegation {
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
