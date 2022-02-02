//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";

/// @dev Defines core functionality for recording votes in ElectionModule.elect()
abstract contract ElectionVotes is ElectionBase {
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
        election.ballotIdsByAddress[voter] = ballotId;

        return ballotId;
    }

    function _withdrawVote(address voter, uint votePower) internal virtual returns (bytes32 ballotId) {
        ElectionData storage election = _getCurrentElection();

        ballotId = election.ballotIdsByAddress[voter];
        BallotData storage ballot = _getBallot(ballotId);

        ballot.votes -= votePower;
        election.ballotIdsByAddress[voter] = bytes32(0);

        return ballotId;
    }

    /// @dev Override this function to specify how vote power is calculated
    function _getVotePower(address) internal view virtual returns (uint);
}
