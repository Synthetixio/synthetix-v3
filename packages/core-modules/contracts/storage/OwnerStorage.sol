//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract OwnerStorage {
    struct OwnerNamespace {
        address owner;
        address nominatedOwner;
    }

    function _ownerStorage() internal pure returns (OwnerNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.owner")) - 1)
            store.slot := 0x1f33674ed9c09f309c0798b8fcbe9c48911f48b2defee8aecb930c5ef6f80e37
        }
    }
}
