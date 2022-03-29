//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "./ElectionBase.sol";

/// @dev Implements merkle-tree migration/declaration of debt shares on L1
contract ElectionVotesL1 is ElectionBase {
    function _setL1DebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) internal {
        ElectionData storage election = _getCurrentElection();

        // store.currentEpochIndex = index;
        if (election.merkleRoot != 0) {
            revert MerkleRootAlreadySet();
        }

        election.merkleRoot = merkleRoot;
        election.merkleRootBlocknumber = blocknumber;
    }

    function _declareL1DebtShare(
        address voter,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        ElectionData storage election = _getCurrentElection();

        // store.currentEpochIndex = index;
        if (election.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        // build leaf
        bytes32 leaf = keccak256(abi.encodePacked(voter, debtShare));

        if (!MerkleProof.verify(merkleProof, election.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        election.l1DebtShares[voter] = debtShare;
    }

    function _getL1DebtShare(address voter) internal view returns (uint) {
        return _getCurrentElection().l1DebtShares[voter];
    }

    function _getVotePowerL1(address voter) internal view returns (uint) {
        return _getL1DebtShare(voter);
    }
}
