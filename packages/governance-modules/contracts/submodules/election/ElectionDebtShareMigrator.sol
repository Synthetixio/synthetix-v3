//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "./ElectionBase.sol";

/// @dev Defines core vote-counting / ballot-processing functionality in ElectionModule.evaluate()
contract ElectionDebtShareMigrator is ElectionBase {
    function _setMerkleRoot(bytes32 merkleRoot) internal {
        ElectionData storage election = _getCurrentElection();

        // store.currentEpochIndex = index;
        if (election.merkleroot != 0) {
            revert MerkleRootAlreadySet();
        }

        election.merkleroot = merkleRoot;
    }

    function _declareL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        ElectionData storage election = _getCurrentElection();

        // store.currentEpochIndex = index;
        if (election.merkleroot == 0) {
            revert MerkleRootNotSet();
        }

        // build leaf
        bytes32 leaf = keccak256(abi.encodePacked(voter, debtShare));

        if (!MerkleProof.verify(merkleProof, election.merkleroot, leaf)) {
            revert InvalidMerkleProof();
        }

        election.l1debtshares[voter] = debtShare;
    }

    function _getL1DebtShare(address voter) internal view returns (uint) {
        return _getCurrentElection().l1debtshares[voter];
    }
}
