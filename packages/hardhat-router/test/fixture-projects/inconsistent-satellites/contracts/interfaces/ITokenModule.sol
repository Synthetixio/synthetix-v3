//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface ITokenModule {
    function getSatellitesInvalid() external pure returns (ISatelliteFactory.Satellite[] memory);
}
