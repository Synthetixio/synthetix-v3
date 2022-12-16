// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact contracts/storage/GlobalStorage.sol:GlobalStorage
contract GlobalStorage {
    bytes32 private constant _slotGlobalStorage = keccak256(abi.encode("io.synthetix.hardhat-router.Global"));
    struct GlobalStore {
        uint value;
        uint someValue;
    }
    function _globalStore() internal pure returns (GlobalStore storage store) {
        bytes32 s = _slotGlobalStorage;
        assembly {
            store.slot := s
        }
    }
}
