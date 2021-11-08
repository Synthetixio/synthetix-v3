//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract BeaconStorage {
    struct BeaconNamespace {
        address beacon;
    }

    function _beaconStorage() internal pure returns (BeaconNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.beacon")) - 1)
            store.slot := 0x8517a71f7c502435ad2f4c47d666cac507d0f6ec211fa4218a800991aa5164cc
        }
    }
}
