//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AnotherModuleStorage {
    struct AnotherModuleStore {
        uint theValue;
    }

    function _anotherModuleStore() internal pure returns (AnotherModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.repeated")) - 1)
            store.slot := 0xed7cf6e81ca4961ccdcf1a1de20a869fbf208e98f9befafc1456ecc7de84e195
        }
    }
}
