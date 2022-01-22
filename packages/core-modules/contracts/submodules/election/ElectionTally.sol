//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionTally is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function _evalauteNextBallotBatch() internal {
        EpochData storage epoch = _getCurrentEpoch();

        uint numBallots = store.ballotIds.length;
        for (uint ballotIndex = 0; ballotIndex < numBallots; ballotIndex++) {
            bytes32 ballotId = store.ballotIds[ballotIndex];
            BallotData storage ballot = epoch.ballotsById[ballotId];

            _evaluateBallot(ballot);
        }
    }

    function _evaluateBallot(BallotData storage ballot) internal {
        uint ballotVotePower = ballot.votePower;
        if (ballotVotePower == 0) {
            return;
        }

        address[] memory ballotCandidates = ballot.candidates;

        uint numCandidates = ballotCandidates.length;
        for (uint candidateIndex = 0; candidateIndex < numCandidates; candidateIndex++) {
            address candidate = ballot.candiates[candidateIndex];

            epoch.candidateVotes[candidate] += ballot.votePower;
        }
    }
}
