//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/// @dev Defines core functionality for recording votes in ElectionModule.cast()
contract ElectionVotes is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    using Council for Council.Data;
    using Election for Election.Data;
    using Ballot for Ballot.Data;

    function _validateCandidates(address[] calldata candidates) internal virtual {
        uint256 length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        for (uint256 i = 0; i < length; i++) {
            address candidate = candidates[i];

            // Reject candidates that are not nominated.
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Reject duplicate candidates.
            if (i < length - 1) {
                for (uint256 j = i + 1; j < length; j++) {
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
        uint256 votePower,
        address[] calldata candidates
    ) internal virtual returns (bytes32 ballotId) {
        Election.Data storage election = Council.load().getCurrentElection();

        ballotId = keccak256(abi.encode(candidates));
        Ballot.Data storage ballot = election.ballotsById[ballotId];

        // Initialize ballot if new.
        if (!ballot.isInitiated()) {
            address[] memory newCandidates = candidates;

            ballot.candidates = newCandidates;

            election.ballotIds.push(ballotId);
        }

        ballot.votes += votePower;
        ballot.votesByUser[user] = votePower;
        election.ballotIdsByAddress[user] = ballotId;

        return ballotId;
    }

    function _withdrawVote(
        address user,
        uint256 votePower
    ) internal virtual returns (bytes32 ballotId) {
        Election.Data storage election = Council.load().getCurrentElection();

        ballotId = election.ballotIdsByAddress[user];
        Ballot.Data storage ballot = election.ballotsById[ballotId];

        ballot.votes -= votePower;
        ballot.votesByUser[user] = 0;
        election.ballotIdsByAddress[user] = bytes32(0);

        return ballotId;
    }

    function _withdrawCastedVote(address user, uint256 epochIndex) internal virtual {
        uint256 castedVotePower = _getCastedVotePower(user);

        bytes32 ballotId = _withdrawVote(user, castedVotePower);

        emit VoteWithdrawn(user, ballotId, epochIndex, castedVotePower);
    }

    function _getCastedVotePower(address user) internal virtual returns (uint256 votePower) {
        Election.Data storage election = Council.load().getCurrentElection();

        bytes32 ballotId = election.ballotIdsByAddress[user];
        Ballot.Data storage ballot = election.ballotsById[ballotId];

        return ballot.votesByUser[user];
    }

    function _getVotePower(address) internal view virtual returns (uint256) {
        return 1;
    }
}
