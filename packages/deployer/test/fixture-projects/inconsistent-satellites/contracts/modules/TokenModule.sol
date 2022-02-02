//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/ITokenModule.sol";

contract TokenModule is SatelliteFactory, ITokenModule {
    function _getSatellites() internal pure override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](0);
        return satellites;
    }

    function getSatellitesInvalid() external pure override returns (Satellite[] memory) {
        return _getSatellites();
    }
}
