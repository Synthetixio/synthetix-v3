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
        uint length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

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
        uint votePower
    ) internal virtual returns (bytes32 ballotId) {
        Election.Data storage election = Council.load().getCurrentElection();

        ballotId = election.ballotIdsByAddress[user];
        Ballot.Data storage ballot = election.ballotsById[ballotId];

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
        Election.Data storage election = Council.load().getCurrentElection();

        bytes32 ballotId = election.ballotIdsByAddress[user];
        Ballot.Data storage ballot = election.ballotsById[ballotId];

        return ballot.votesByUser[user];
    }

    // TODO: New vote power computation:
    // e.g. # of SNX tokens in 'SC-approved' v3 pools + merkle tree for v2x
    // for next voting period, we'll support v2x voting power through merkle tree; reuse existing code and then disable merkle tree later on when were moved over to v3
    //
    // Bonus: with the current merkle tree implementation, we are storing the results on the contract when the user submits a vote.
    // This defeats one of the purposes of having the merkle tree (not having to store the data)
    // So if there's time it would be great to refactor this to not store any data.
    function _getVotePower(address) internal view virtual returns (uint) {
        return 1;
    }
}
