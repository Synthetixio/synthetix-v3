//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DebtShareBase {
    // ---------------------------------------
    // Errors
    // ---------------------------------------

    error DebtShareContractNotSet();
    error MerkleRootNotSet();
    error MerkleRootAlreadySet();
    error InvalidMerkleProof();

    // ---------------------------------------
    // Events
    // ---------------------------------------

    event DebtShareContractSet(address debtShareContractAddress);
    event DebtShareSnapshotTaken(uint128 snapshotId);
    event CrossChainDebtShareMerkleRootSet(bytes32 merkleRoot, uint blocknumber, uint epoch);
    event CrossChainDebtShareDeclared(address voter, uint debtShare);
}
