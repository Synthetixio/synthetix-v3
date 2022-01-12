//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InitializableStorage {
    struct InitializableStore {
        bool initialized;
    }

    function _initializableStore() internal pure returns (InitializableStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.initializable")) - 1)
            store.slot := 0xe1550b5a17836cfadda6044cd412df004a72cf007361a046298ac83a7992948c
        }
    }
}
