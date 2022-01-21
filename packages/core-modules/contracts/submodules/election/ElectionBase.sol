//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

contract ElectionBase is ElectionStorage {
    error EpochNotEvaluated();
    error AlreadyNominated();
    error NotNominated();
    error NoCandidates();
    error NoVotePower();
    error DuplicateCandidates();
    error InvalidEpochConfiguration();
    error InvalidElectionSettings();
    error NotCallableInCurrentPeriod();
    error BallotDoesNotExist();

    function _isInitialized() internal view virtual returns (bool) {
        return _electionStore().initialized;
    }

    function _getCurrentEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_electionStore().currentEpochIndex);
    }

    function _getNextEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_electionStore().currentEpochIndex + 1);
    }

    function _getEpochAtPosition(uint position) internal view returns (EpochData storage) {
        return _electionStore().epochs[position];
    }

    function _getBallot(bytes32 ballotId) internal view returns (BallotData storage) {
        return _getCurrentEpoch().ballotsById[ballotId];
    }

    function _calculateBallotId(address[] memory candidates) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(candidates));
    }

    function _ballotExists(BallotData storage ballot) internal view returns (bool) {
        return ballot.candidates.length != 0;
    }

    function _getBallotVoted(address voter) internal view returns (bytes32) {
        return _getCurrentEpoch().ballotsByAddress[voter];
    }

    function _hasVoted(address voter) internal view returns (bool) {
        return _getBallotVoted(voter) != bytes32(0);
    }
}
