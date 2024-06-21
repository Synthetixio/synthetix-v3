//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {Council} from "../../storage/Council.sol";
import {Election} from "../../storage/Election.sol";
import {ElectionSettings} from "../../storage/ElectionSettings.sol";

/// @dev Defines core vote-counting / ballot-processing functionality in ElectionModule.evaluate()
contract ElectionTally {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using Council for Council.Data;

    uint16 private constant _DEFAULT_EVALUATION_BATCH_SIZE = 500;

    function _evaluateNextBallotBatch(uint256 numBallots) internal {
        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        ElectionSettings.Data storage settings = council.getCurrentElectionSettings();

        if (numBallots == 0) {
            numBallots = _DEFAULT_EVALUATION_BATCH_SIZE;
        }

        uint256 totalBallots = election.ballotPtrs.length();

        uint256 firstBallotIndex = election.numEvaluatedBallots;

        uint256 lastBallotIndex = firstBallotIndex + numBallots;
        if (lastBallotIndex > totalBallots) {
            lastBallotIndex = totalBallots;
        }

        _evaluateBallotRange(election, settings, firstBallotIndex, lastBallotIndex);
    }

    function _evaluateBallotRange(
        Election.Data storage election,
        ElectionSettings.Data storage settings,
        uint256 fromIndex,
        uint256 toIndex
    ) private {
        uint256 numSeats = settings.epochSeatCount;

        for (uint256 ballotIndex = fromIndex; ballotIndex < toIndex; ballotIndex++) {
            bytes32 ballotPtr = election.ballotPtrs.valueAt(ballotIndex + 1);
            Ballot.Data storage ballot;

            assembly {
                ballot.slot := ballotPtr
            }

            _evaluateBallot(election, ballot, numSeats);
        }
    }

    function _evaluateBallot(
        Election.Data storage election,
        Ballot.Data storage ballot,
        uint256 numSeats
    ) internal {
        uint256 numCandidates = ballot.votedCandidates.length;

        for (uint256 candidateIndex = 0; candidateIndex < numCandidates; candidateIndex++) {
            address candidate = ballot.votedCandidates[candidateIndex];

            uint256 currentCandidateVotes = election.candidateVoteTotals[candidate];
            uint256 newCandidateVotes = currentCandidateVotes + ballot.amounts[candidateIndex];
            election.candidateVoteTotals[candidate] = newCandidateVotes;

            _updateWinnerSet(election, candidate, newCandidateVotes, numSeats);
        }

        election.numEvaluatedBallots += 1;
    }

    function _updateWinnerSet(
        Election.Data storage election,
        address candidate,
        uint256 candidateVotes,
        uint256 numSeats
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
        (address leastVotedWinner, uint256 leastVotes) = _findWinnerWithLeastVotes(
            election,
            winners
        );

        if (candidateVotes > leastVotes) {
            winners.replace(leastVotedWinner, candidate);
        }
    }

    function _findWinnerWithLeastVotes(
        Election.Data storage election,
        SetUtil.AddressSet storage winners
    ) private view returns (address leastVotedWinner, uint256 leastVotes) {
        leastVotes = type(uint256).max;

        uint256 numWinners = winners.length();

        for (uint8 winnerPosition = 1; winnerPosition <= numWinners; winnerPosition++) {
            address winner = winners.valueAt(winnerPosition);
            uint256 winnerVotes = election.candidateVoteTotals[winner];

            if (winnerVotes < leastVotes) {
                leastVotes = winnerVotes;

                leastVotedWinner = winner;
            }
        }

        return (leastVotedWinner, leastVotes);
    }
}
