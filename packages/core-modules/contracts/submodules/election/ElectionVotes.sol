//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";

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

            // Not nominated?
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Duplicate candidates?
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
    ) internal virtual {
        ElectionData storage election = _getCurrentElection();

        bytes32 ballotId = _calculateBallotId(candidates);
        BallotData storage ballot = _getBallot(ballotId);

        // Initialize ballot if new
        if (!_ballotExists(ballot)) {
            address[] memory newCandidates = candidates;

            ballot.candidates = newCandidates;

            election.ballotIds.push(ballotId);
        }

        ballot.votes += votePower;
        election.ballotIdsByAddress[voter] = ballotId;
    }

    function _withdrawVote(address voter, uint votePower) internal virtual {
        ElectionData storage election = _getCurrentElection();

        bytes32 ballotId = election.ballotIdsByAddress[voter];
        BallotData storage ballot = _getBallot(ballotId);

        ballot.votes -= votePower;
        election.ballotIdsByAddress[voter] = bytes32(0);
    }

    function _getVotePower(address) internal view virtual returns (uint) {
        return 1;
    }
}
