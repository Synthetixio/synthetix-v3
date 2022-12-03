//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SampleStorage {
    struct Data {
        uint someValue;
        uint protectedValue;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Sample"));
        assembly {
            store.slot := s
        }
    }
}
