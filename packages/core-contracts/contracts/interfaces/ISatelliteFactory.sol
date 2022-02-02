//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISatelliteFactory {
    struct Satellite {
        bytes32 name;
        bytes32 contractName;
        address deployedAddress;
    }
}
