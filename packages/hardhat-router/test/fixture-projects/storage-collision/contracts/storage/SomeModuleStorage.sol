//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SomeModuleStorage {
    struct SomeModuleStore {
        uint theValue;
    }

    function _someModuleStore() internal pure returns (SomeModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.repeated")) - 1)
            store.slot := 0xed7cf6e81ca4961ccdcf1a1de20a869fbf208e98f9befafc1456ecc7de84e195
        }
    }
}
