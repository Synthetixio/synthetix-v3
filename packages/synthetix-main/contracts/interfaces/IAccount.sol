//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccount {
    function mint(uint requestedAccountId, address owner) external;

    function stake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    function hasRole(
        uint accountId,
        bytes32 role,
        address target
    ) external view returns (bool);

    function grantRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    function revokeRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;

    function renounceRole(
        uint accountId,
        bytes32 role,
        address target
    ) external;
}
