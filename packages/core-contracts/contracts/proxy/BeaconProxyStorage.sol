//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract BeaconProxyStorage {
    struct BeaconProxyStore {
        address beacon;
    }

    function _beaconProxyStore() internal pure returns (BeaconProxyStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.beaconProxy")) - 1)
            store.slot := 0x2395510979f6f33ca6b2853f771301ac5a746521967963945952ce833e51405c
        }
    }
}
