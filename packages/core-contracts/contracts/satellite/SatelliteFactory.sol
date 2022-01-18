//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract SatelliteFactory {
    struct Satellite {
        string id;
        string contractName;
        address deployedAddress;
    }

    function _getSatellites() internal view virtual returns (Satellite[] memory);
}
