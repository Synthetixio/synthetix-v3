//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionTally is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function _evaluateNextBallotBatch(uint numBallots) internal {
        if (numBallots == 0) {
            numBallots = _electionStore().settings.defaultBallotEvaluationBatchSize;
        }

        ElectionData storage election = _getCurrentElection();
        uint totalBallots = election.ballotIds.length;

        uint firstBallotIndex = election.numEvaluatedBallots;

        uint lastBallotIndex = firstBallotIndex + numBallots;
        if (lastBallotIndex >= totalBallots) {
            lastBallotIndex = totalBallots - 1;

            election.evaluated = true;
        }

        _evaluateBallotRange(election, firstBallotIndex, lastBallotIndex);
    }

    function _evaluateBallotRange(
        ElectionData storage election,
        uint fromIndex,
        uint toIndex
    ) internal {
        ElectionModuleSettings storage settings = _electionStore().settings;
        uint numSeats = settings.nextEpochSeatCount;

        for (uint ballotIndex = fromIndex; ballotIndex <= toIndex; ballotIndex++) {
            bytes32 ballotId = election.ballotIds[ballotIndex];
            BallotData storage ballot = election.ballotsById[ballotId];

            _evaluateBallot(election, ballot, numSeats);
        }
    }

    function _evaluateBallot(
        ElectionData storage election,
        BallotData storage ballot,
        uint numSeats
    ) internal {
        uint ballotVotes = ballot.votes;
        if (ballotVotes == 0) {
            return;
        }

        address[] memory ballotCandidates = ballot.candidates;

        uint numCandidates = ballotCandidates.length;
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
    ) internal {
        SetUtil.AddressSet storage winners = election.winners;
        if (winners.contains(candidate)) {
            return;
        }

        // Just take first empty seat.
        if (winners.length() < numSeats) {
            winners.add(candidate);

            return;
        }

        // Otherwise see if there is a winning candidate with less votes to take its seat.
        for (uint8 winnerPosition = 1; winnerPosition <= numSeats; winnerPosition++) {
            address winner = winners.valueAt(winnerPosition);
            uint winnerVotes = election.candidateVotes[winner];

            if (candidateVotes > winnerVotes) {
                winners.replace(winner, candidate);

                return;
            }
        }
    }

    function _setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) internal {
        if (newDefaultBallotEvaluationBatchSize == 0) {
            revert InvalidElectionSettings();
        }

        _electionStore().settings.defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;
    }
}
