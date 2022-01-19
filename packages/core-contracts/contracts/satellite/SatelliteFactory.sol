//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct Satellite {
    bytes32 id;
    string contractName;
    address deployedAddress;
}

abstract contract SatelliteFactory {
    function _getSatellite() internal view virtual returns (Satellite memory);
}

abstract contract SatellitesFactory {
    function _getSatellites() internal view virtual returns (Satellite[] memory);
}
