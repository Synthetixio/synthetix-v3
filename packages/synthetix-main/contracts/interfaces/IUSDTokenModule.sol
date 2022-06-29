//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IUSDTokenModule is ISatelliteFactory {
    function initializeUSDTokenModule() external;

    function isUSDTokenModuleInitialized() external view returns (bool);

    function upgradeUSDImplementation(address newUSDTokenImplementation) external;

    function getUSDTokenAddress() external view returns (address);

    function getUSDTokenModuleSatellites() external view returns (Satellite[] memory);
}
