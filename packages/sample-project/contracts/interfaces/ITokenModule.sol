//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface ITokenModule is ISatelliteFactory {
    function getTokenModuleSatellites() external view returns (Satellite[] memory);

    function createSampleToken(bytes32 name) external;
}
