//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ElectionTally.sol";

/// @dev Basic way of counting votes in ElectionModule.evaluate()
contract ElectionTallyPlurality is ElectionTally {
    using SetUtil for SetUtil.AddressSet;

    function _evaluateBallot(
        ElectionData storage election,
        BallotData storage ballot,
        uint numSeats
    ) internal override {
        uint ballotVotes = ballot.votes;
        if (ballotVotes == 0) {
            return;
        }

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
        ElectionData storage election,
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

    function _findWinnerWithLeastVotes(ElectionData storage election, SetUtil.AddressSet storage winners)
        private
        view
        returns (address leastVotedWinner, uint leastVotes)
    {
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
