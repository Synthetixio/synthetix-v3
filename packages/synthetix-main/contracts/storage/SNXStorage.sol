//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SNXStorage {
    struct SNXNamespace {
        address owner;
        address implementation;
        bool simulatingUpgrade;
        bool initialized;
    }

    function _snxStorage() internal pure returns (SNXNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx")) - 1)
            store.slot := 0xda971e173e56dd9f06613926a469814aa157a8d69f32b83295080bffaad6d790
        }
    }
}
