//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IAccountModule is ISatelliteFactory {
    function initializeAccountModule() external;

    function isAccountModuleInitialized() external view returns (bool);

    function upgradeAccountImplementation(address newAccountImplementation) external;

    function getAccountAddress() external view returns (address);

    function getAccountModuleSatellites() external view returns (Satellite[] memory);

    // SCCP
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
}
