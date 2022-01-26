//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract SatelliteFactory {
    struct Satellite {
        bytes32 name;
        bytes32 contractName;
        address deployedAddress;
    }

    function _getSatellites() internal view virtual returns (Satellite[] memory);
}
