//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

/// @dev Defines core vote-counting / ballot-processing functionality in ElectionModule.evaluate()
abstract contract ElectionTally is ElectionBase {
    function _evaluateNextBallotBatch(uint numBallots) internal {
        if (numBallots == 0) {
            numBallots = _electionSettings().defaultBallotEvaluationBatchSize;
        }

        ElectionData storage election = _getCurrentElection();
        uint totalBallots = election.ballotIds.length;

        uint firstBallotIndex = election.numEvaluatedBallots;

        uint lastBallotIndex = firstBallotIndex + numBallots;
        if (lastBallotIndex > totalBallots) {
            lastBallotIndex = totalBallots;
        }

        _evaluateBallotRange(election, firstBallotIndex, lastBallotIndex);
    }

    function _evaluateBallotRange(
        ElectionData storage election,
        uint fromIndex,
        uint toIndex
    ) private {
        ElectionSettings storage settings = _electionSettings();
        uint numSeats = settings.nextEpochSeatCount;

        for (uint ballotIndex = fromIndex; ballotIndex < toIndex; ballotIndex++) {
            bytes32 ballotId = election.ballotIds[ballotIndex];
            BallotData storage ballot = election.ballotsById[ballotId];

            _evaluateBallot(election, ballot, numSeats);
        }
    }

    /// @dev Override this function to specify how votes are counted
    function _evaluateBallot(
        ElectionData storage election,
        BallotData storage ballot,
        uint numSeats
    ) internal virtual;
}
