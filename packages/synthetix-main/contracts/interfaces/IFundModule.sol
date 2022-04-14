//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface IFundModule is ISatelliteFactory {
    function initializeFundModule() external;

    function isFundModuleInitialized() external view returns (bool);

    function upgradeFundImplementation(address newFundImplementation) external;

    function getFundAddress() external view returns (address);

    function getFundModuleSatellites() external view returns (Satellite[] memory);
}
