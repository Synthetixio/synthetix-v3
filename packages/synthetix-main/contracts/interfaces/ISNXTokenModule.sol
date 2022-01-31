//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface ISNXTokenModule is ISatelliteFactory {
    function initializeSNXTokenModule() external;

    function isSNXTokenModuleInitialized() external view returns (bool);

    function upgradeSNXImplementation(address newSNXTokenImplementation) external;

    function getSNXTokenAddress() external view returns (address);

    function getSNXTokenModuleSatellites() external view returns (Satellite[] memory);

}
