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

        SetUtil.AddressSet storage nominees = _getCurrentEpoch().nominees;

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
        EpochData storage epoch = _getCurrentEpoch();

        bytes32 oldBallotId = epoch.ballotIdFromVoterAddress[voter];
        bytes32 newBallotId = _getBallotId(candidates);
        if (newBallotId == oldBallotId) {
            revert ChangeError.NoChange();
        }

        // Clear previous vote
        if (oldBallotId != bytes32(0)) {
            BallotData storage oldBallot = _getBallot(oldBallotId);

            oldBallot.votes -= votePower;
        }

        BallotData storage newBallot = _getBallot(newBallotId);

        // Initialize ballot if new
        if (!_ballotExists(newBallot)) {
            address[] memory newCandidates = candidates;

            newBallot.candidates = newCandidates;
        }

        newBallot.votes += votePower;
        epoch.ballotIdFromVoterAddress[voter] = newBallotId;
    }

    function _votePowerOf(address) internal view virtual returns (uint) {
        return 1;
    }
}
