//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface ISUSDTokenModule is ISatelliteFactory {
    function initializeSUSDTokenModule() external;

    function isSUSDTokenModuleInitialized() external view returns (bool);

    function upgradeSUSDImplementation(address newSUSDTokenImplementation) external;

    function getSUSDTokenAddress() external view returns (address);

    function getSUSDTokenModuleSatellites() external view returns (Satellite[] memory);
}
