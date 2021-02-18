//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;


contract StatusStorageNamespace {
    struct StatusStorage {
        bool systemSuspended;
    }

    function _statusStorage() internal pure returns (StatusStorage storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.status")) - 1)
            store.slot := 0x8cac0178861ee96d908af83b970b018477fe185479d8120155b5eccee53c083e
        }
    }
}

