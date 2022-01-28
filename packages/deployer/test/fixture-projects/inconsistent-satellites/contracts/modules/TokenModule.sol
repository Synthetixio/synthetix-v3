//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract TokenModule is SatelliteFactory {
    Satellite[] private _satellites;

    function _getSatellites() internal view override returns (Satellite[] memory) {
        return _satellites;
    }

    function getSatellitesInvalid() public view returns (Satellite[] memory) {
        return _getSatellites();
    }
}
