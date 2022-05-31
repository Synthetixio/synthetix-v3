//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/// @dev Defines core functionality for recording votes in ElectionModule.cast()
contract ElectionVotes is ElectionBase {
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
        address user,
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
        ballot.votesByUser[user] = votePower;
        election.ballotIdsByAddress[user] = ballotId;

        return ballotId;
    }

    function _withdrawVote(address user, uint votePower) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = election.ballotIdsByAddress[user];
        BallotData storage ballot = _getBallot(ballotId);

        ballot.votes -= votePower;
        ballot.votesByUser[user] = 0;
        election.ballotIdsByAddress[user] = bytes32(0);

        return ballotId;
    }

    function _withdrawCastedVote(address user, uint epochIndex) internal virtual {
        uint castedVotePower = _getCastedVotePower(user);

        bytes32 ballotId = _withdrawVote(user, castedVotePower);

        emit VoteWithdrawn(user, ballotId, epochIndex, castedVotePower);
    }

    function _getCastedVotePower(address user) internal virtual returns (uint votePower) {
        ElectionData storage election = _getCurrentElection();

        bytes32 ballotId = election.ballotIdsByAddress[user];
        BallotData storage ballot = _getBallot(ballotId);

        return ballot.votesByUser[user];
    }

    function _getVotePower(address) internal view virtual returns (uint) {
        return 1;
    }
}
