//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";

contract SynthsStorage {
    struct SynthsStore {
        bool initialized;
        address beacon;
        mapping(bytes32 => SatelliteFactory.Satellite) synths;
        bytes32[] synthNames;
    }

    function _synthsStore() internal pure returns (SynthsStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.synths")) - 1)
            store.slot := 0x9fde256fa7e85ac1e971ef0dbc4acd7439598f5683a6dc8075abd053cd66adca
        }
    }
}
