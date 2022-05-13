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
}
