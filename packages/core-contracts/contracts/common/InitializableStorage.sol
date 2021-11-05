//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InitializableStorage {
    struct InitializableStore {
        bool initializing;
        bool initialized;
    }

    function _initializableStore() internal pure returns (InitializableStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.Initializable")) - 1)
            store.slot := 0xcd049771a6cc1f24ccaf0f5241835e330e5bbe0842b85869f08e8408d94bb746
        }
    }
}
