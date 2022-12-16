//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InitializableStorage {
    bytes32 private constant _slotInitializableStorage =
        keccak256(abi.encode("io.synthetix.sample-project.Initializable"));

    struct InitializableStore {
        bool initialized;
    }

    function _initializableStore() internal pure returns (InitializableStore storage store) {
        bytes32 s = _slotInitializableStorage;
        assembly {
            store.slot := s
        }
    }
}
