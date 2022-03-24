//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "./ElectionVotesL1.sol";
import "./ElectionVotesL2.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/// @dev Defines core functionality for recording votes in ElectionModule.cast()
abstract contract ElectionVotes is ElectionBase, ElectionVotesL1, ElectionVotesL2 {
    using SetUtil for SetUtil.AddressSet;

    function _validateCandidates(address[] calldata candidates) internal virtual {
        uint length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        for (uint i = 0; i < length; i++) {
            address candidate = candidates[i];

            // Reject candidates that are not nominated.
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Reject duplicate candidates.
            if (i < length - 1) {
                for (uint j = i + 1; j < length; j++) {
                    address otherCandidate = candidates[j];

                    if (candidate == otherCandidate) {
                        revert DuplicateCandidates();
                    }
                }
            }
        }
    }

    function _recordVote(
        address voter,
        uint votePower,
        address[] calldata candidates
    ) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = _calculateBallotId(candidates);
        BallotData storage ballot = _getBallot(ballotId);

        // Initialize ballot if new.
        if (!_ballotExists(ballot)) {
            address[] memory newCandidates = candidates;

            ballot.candidates = newCandidates;

            election.ballotIds.push(ballotId);
        }

        ballot.votes += votePower;
        ballot.votesByUser[voter] = votePower;
        election.ballotIdsByAddress[voter] = ballotId;

        return ballotId;
    }

    function _withdrawVote(address voter, uint votePower) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = election.ballotIdsByAddress[voter];
        BallotData storage ballot = _getBallot(ballotId);

        ballot.votes -= votePower;
        ballot.votesByUser[voter] = 0;
        election.ballotIdsByAddress[voter] = bytes32(0);

        return ballotId;
    }

    function _getCastedVotePower(address voter) internal virtual returns (uint votePower) {
        ElectionData storage election = _getCurrentElection();

        bytes32 ballotId = election.ballotIdsByAddress[voter];
        BallotData storage ballot = _getBallot(ballotId);

        return ballot.votesByUser[voter];
    }

    function _getVotePower(address voter) internal view returns (uint) {
        uint votePower = _getVotePowerL1(voter) + _getVotePowerL2(voter);

        return MathUtil.sqrt(votePower);
    }
}
