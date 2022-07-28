//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AssociatedSystemsStorage {
    struct AssociatedSystem {
        address proxy;
        address impl;
        bytes32 kind;
    }

    struct AssociatedSystemsStore {
        mapping (bytes32 => AssociatedSystem) satellites;
    }

    // solhint-disable-next-line func-name-mixedcase
    function _associatedSystemsStore() internal pure returns (AssociatedSystemsStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.associatedSystems")) - 1)
            // todo
            store.slot := 0x785a57f03c313e176889dae7a58117996eec43895df200b08edcd72475725cd5
        }
    }
}