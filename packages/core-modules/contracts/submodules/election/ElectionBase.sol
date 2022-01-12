//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

contract ElectionBase is ElectionStorage {
    // ----------------------------------
    // Current epoch views
    // ----------------------------------

    function getEpochIndex() public view returns (uint) {
        return _electionStore().currentEpochIndex;
    }

    function getEpochStartDate() public view returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    function getEpochEndDate() public view returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    function getNominationPeriodStartDate() public view returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    function getVotingPeriodStartDate() public view returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    function isCurrentEpochEvaluated() public view returns (bool) {
        return _getCurrentEpoch().evaluated;
    }

    // ----------------------------------
    // Next epoch views
    // ----------------------------------

    function getNextEpochStartDate() public view returns (uint64) {
        return _getNextEpoch().startDate;
    }

    function getNextEpochEndDate() public view returns (uint64) {
        return _getNextEpoch().endDate;
    }

    function getNextEpochNominationPeriodStartDate() public view returns (uint64) {
        return _getNextEpoch().nominationPeriodStartDate;
    }

    function getNextEpochVotingPeriodStartDate() public view returns (uint64) {
        return _getNextEpoch().votingPeriodStartDate;
    }

    // ----------------------------------
    // Utils
    // ----------------------------------

    function _getCurrentEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_electionStore().currentEpochIndex);
    }

    function _getNextEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_electionStore().currentEpochIndex + 1);
    }

    function _getEpochAtPosition(uint position) internal view returns (EpochData storage) {
        return _electionStore().epochs[position];
    }
}
