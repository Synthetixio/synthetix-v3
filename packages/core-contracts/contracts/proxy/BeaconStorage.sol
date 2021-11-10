//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract BeaconStorage {
    struct BeaconStore {
        address beacon; // this is where the beacon address is stored, is is set only in the BeaconProxy
        address implementation; //this is where the beacon implementation is stored, it is set only in the Beacon
    }

    function _beaconStore() internal pure returns (BeaconStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.beacon")) - 1)
            store.slot := 0x8517a71f7c502435ad2f4c47d666cac507d0f6ec211fa4218a800991aa5164cc
        }
    }
}
