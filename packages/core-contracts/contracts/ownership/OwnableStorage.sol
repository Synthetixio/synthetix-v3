//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OwnableStorage {
    struct OwnableNamespace {
        address owner;
        address nominatedOwner;
    }

    function _ownableStorage() internal pure returns (OwnableNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.ownable")) - 1)
            store.slot := 0x66d20a9eef910d2df763b9de0d390f3cc67f7d52c6475118cd57fa98be8cf6cb
        }
    }
}
