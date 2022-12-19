//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GlobalStorage {
    bytes32 private constant _SLOT_GLOBAL_STORAGE =
        keccak256(abi.encode("io.synthetix.sample-project.Global"));

    struct GlobalStore {
        uint value;
        uint someValue;
    }

    function _globalStore() internal pure returns (GlobalStore storage store) {
        bytes32 s = _SLOT_GLOBAL_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
