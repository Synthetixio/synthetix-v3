//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

import "../../storage/Council.sol";

/// @dev Defines core vote-counting / ballot-processing functionality in ElectionModule.evaluate()
contract ElectionTally is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    using Council for Council.Data;

    function _evaluateNextBallotBatch(uint numBallots) internal {
        Election.Data storage election = Council.load().getCurrentElection();

        if (numBallots == 0) {
            numBallots = election.settings.defaultBallotEvaluationBatchSize;
        }

        uint totalBallots = election.ballotIds.length;

        uint firstBallotIndex = election.numEvaluatedBallots;

        uint lastBallotIndex = firstBallotIndex + numBallots;
        if (lastBallotIndex > totalBallots) {
            lastBallotIndex = totalBallots;
        }

        _evaluateBallotRange(election, firstBallotIndex, lastBallotIndex);
    }

    function _evaluateBallotRange(
        Election.Data storage election,
        uint fromIndex,
        uint toIndex
    ) private {
        uint numSeats = election.settings.nextEpochSeatCount;

        for (uint ballotIndex = fromIndex; ballotIndex < toIndex; ballotIndex++) {
            bytes32 ballotId = election.ballotIds[ballotIndex];
            Ballot.Data storage ballot = election.ballotsById[ballotId];

            _evaluateBallot(election, ballot, numSeats);
        }
    }

    function _evaluateBallot(
        Election.Data storage election,
        Ballot.Data storage ballot,
        uint numSeats
    ) internal {
        uint ballotVotes = ballot.votes;

        uint numCandidates = ballot.candidates.length;
        for (uint candidateIndex = 0; candidateIndex < numCandidates; candidateIndex++) {
            address candidate = ballot.candidates[candidateIndex];

            uint currentCandidateVotes = election.candidateVotes[candidate];
            uint newCandidateVotes = currentCandidateVotes + ballotVotes;
            election.candidateVotes[candidate] = newCandidateVotes;

            _updateWinnerSet(election, candidate, newCandidateVotes, numSeats);
        }

        election.numEvaluatedBallots += 1;
    }

    function _updateWinnerSet(
        Election.Data storage election,
        address candidate,
        uint candidateVotes,
        uint numSeats
    ) private {
        SetUtil.AddressSet storage winners = election.winners;

        // Already a winner?
        if (winners.contains(candidate)) {
            return;
        }

        // Just take first empty seat if
        // the set is not complete yet.
        if (winners.length() < numSeats) {
            winners.add(candidate);

            return;
        }

        // Otherwise, replace the winner with the least votes
        // in the set.
        (address leastVotedWinner, uint leastVotes) = _findWinnerWithLeastVotes(election, winners);

        if (candidateVotes > leastVotes) {
            winners.replace(leastVotedWinner, candidate);
        }
    }

    function _findWinnerWithLeastVotes(
        Election.Data storage election,
        SetUtil.AddressSet storage winners
    ) private view returns (address leastVotedWinner, uint leastVotes) {
        leastVotes = type(uint).max;

        uint numWinners = winners.length();

        for (uint8 winnerPosition = 1; winnerPosition <= numWinners; winnerPosition++) {
            address winner = winners.valueAt(winnerPosition);
            uint winnerVotes = election.candidateVotes[winner];

            if (winnerVotes < leastVotes) {
                leastVotes = winnerVotes;

                leastVotedWinner = winner;
            }
        }

        return (leastVotedWinner, leastVotes);
    }
}
