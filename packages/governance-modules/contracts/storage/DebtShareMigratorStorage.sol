//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DebtShareMigratorStorage {
    struct DebtShareMigratorStore {
        mapping(uint => MerkleEpochData) epochs;
    }

    struct MerkleEpochData {
        bytes32 merkleroot;
        mapping(address => uint) l1debtshares;
    }

    function _debtShareMigratorStore() internal pure returns (DebtShareMigratorStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election.l1migration")) - 1)
            store.slot := 0x79ce4b69b505cd17ab17a795dc1adb23b2a62fa51fe5fc3c01df421f6b2e1d5a
        }
    }
}
