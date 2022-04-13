//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IAccountModule is ISatelliteFactory {
    function initializeAccountModule() external;

    function isAccountModuleInitialized() external view returns (bool);

    function getAccountModuleSatellites() external view returns (Satellite[] memory);
}
