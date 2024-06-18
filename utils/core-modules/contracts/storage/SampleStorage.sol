//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SampleStorage {
    bytes32 private constant _SLOT_SAMPLE_STORAGE =
        keccak256(abi.encode("io.synthetix.core-modules.Sample"));

    struct Data {
        uint256 someValue;
        uint256 protectedValue;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_SAMPLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
