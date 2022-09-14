//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SampleStorage {
    struct SampleStore {
        uint someValue;
        uint protectedValue;
    }

    function _sampleStore() internal pure returns (SampleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.sample")) - 1)
            store.slot := 0x668f9fa59fa554cb1a0ee75e717734dcae86e2969b6d64717c651b6866baf0
        }
    }
}
