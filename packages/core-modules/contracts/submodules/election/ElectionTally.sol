//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionTally is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function _evaluateNextBallotBatch() internal {
        ElectionData storage election = _getCurrentElection();

        uint numBallots = election.ballotIds.length;
        for (uint ballotIndex = 0; ballotIndex < numBallots; ballotIndex++) {
            bytes32 ballotId = election.ballotIds[ballotIndex];
            BallotData storage ballot = election.ballotsById[ballotId];

            _evaluateBallot(election, ballot);
        }

        election.evaluated = true;
    }

    function _evaluateBallot(ElectionData storage election, BallotData storage ballot) internal {
        uint ballotVotes = ballot.votes;
        if (ballotVotes == 0) {
            return;
        }

        address[] memory ballotCandidates = ballot.candidates;

        uint numCandidates = ballotCandidates.length;
        for (uint candidateIndex = 0; candidateIndex < numCandidates; candidateIndex++) {
            address candidate = ballot.candidates[candidateIndex];

            election.candidateVotes[candidate] += ballotVotes;
        }
    }
}
