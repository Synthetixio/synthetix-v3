//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICollateralModule {
    function addCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio
    ) external;

    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    ) external;

    function getCollateralTypes() external view returns (address[] memory collateralTypes);

    function getCollateralType(address collateralType)
        external
        view
        returns (
            address priceFeed,
            uint targetCRatio,
            uint minimumCRatio,
            bool disabled
        );

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

    function getAccountCollateralTotals(uint accountId, address collateralType)
        external
        view
        returns (
            uint,
            uint,
            uint
        );

    function getAccountFreeCollateral(uint accountId, address collateralType) external view returns (uint);

    function getAccountUnassignedCollateral(uint accountId, address collateralType) external view returns (uint);

    function cleanExpiredLockes(
        uint accountId,
        address collateralType,
        uint offset,
        uint items
    ) external;
}
