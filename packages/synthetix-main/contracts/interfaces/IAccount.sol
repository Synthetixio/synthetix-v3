//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccount {
    function mint(address owner, uint requestedAccountId) external;

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

    function assign(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external;

    function unassign(
        uint accountId,
        uint fundId,
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

    function getCollateralTotals(uint accountId, address collateralType)
        external
        view
        returns (
            uint,
            uint,
            uint
        );

    function getUnstakableCollateral(uint accountId, address collateralType) external view returns (uint);

    function getUnassignedCollateral(uint accountId, address collateralType) external view returns (uint);
}
