//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionSchedule is ElectionBase {
    modifier onlyInPeriod(ElectionPeriod period) {
        if (_getCurrentPeriodType() != period) {
            revert NotCallableInCurrentPeriod();
        }

        _;
    }

    function _getCurrentPeriodType() internal view returns (ElectionPeriod) {
        EpochData storage epoch = _getCurrentEpoch();

        uint64 currentTime = uint64(block.timestamp);

        if (currentTime >= _getEpochEndDate(epoch)) {
            return ElectionPeriod.Evaluation;
        }

        if (currentTime >= _getVotingPeriodStartDate(epoch)) {
            return ElectionPeriod.Vote;
        }

        if (currentTime >= _getNominationPeriodStartDate(epoch)) {
            return ElectionPeriod.Nomination;
        }

        return ElectionPeriod.Idle;
    }

    function _configureFirstEpoch(
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) internal {
        EpochData storage firstEpoch = _getEpochAtPosition(1);

        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpoch(firstEpoch, epochStartDate, epochDuration, nominationPeriodDuration, votingPeriodDuration);
    }

    function _configureNextEpoch() internal {
        EpochData storage currentEpoch = _getCurrentEpoch();
        EpochData storage nextEpoch = _getNextEpoch();

        uint64 nextEpochStartDate = uint64(block.timestamp);

        _configureEpoch(
            nextEpoch,
            nextEpochStartDate,
            currentEpoch.duration,
            currentEpoch.nominationPeriodDuration,
            currentEpoch.votingPeriodDuration
        );
    }

    function _adjustEpoch(
        uint64 newEpochEndDate,
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate
    ) internal {
        EpochData storage epoch = _getCurrentEpoch();

        uint64 currentEpochStartDate = epoch.startDate;

        // Date order makes sense?
        if (
            newEpochEndDate <= currentEpochStartDate ||
            newNominationPeriodStartDate >= newVotingPeriodStartDate ||
            newVotingPeriodStartDate >= newEpochEndDate
        ) {
            revert InvalidEpochConfiguration();
        }

        uint64 currentEpochEndDate = currentEpochStartDate + epoch.duration;
        uint64 currentVotingPeriodStartDate = currentEpochEndDate - epoch.votingPeriodDuration;
        uint64 currentNominationPeriodStartDate = currentVotingPeriodStartDate - epoch.nominationPeriodDuration;

        // TODO: Make these settings
        /* solhint-disable */
        uint64 _MAX_EPOCH_DURATION_WIGGLE = 7 days;
        uint64 _MAX_NOMINATION_PERIOD_WIGGLE = 2 days;
        uint64 _MAX_VOTING_PERIOD_WIGGLE = 2 days;

        // New dates not too distant from current dates?
        if (
            _uint64AbsDifference(newEpochEndDate, currentEpochEndDate) > _MAX_EPOCH_DURATION_WIGGLE ||
            _uint64AbsDifference(newNominationPeriodStartDate, currentNominationPeriodStartDate) >
            _MAX_NOMINATION_PERIOD_WIGGLE ||
            _uint64AbsDifference(newVotingPeriodStartDate, currentVotingPeriodStartDate) > _MAX_VOTING_PERIOD_WIGGLE
        ) {
            revert InvalidEpochConfiguration();
        }

        /* solhint-enable */
        uint64 newEpochDuration = newEpochEndDate - currentEpochStartDate;
        uint64 newVotingPeriodDuration = newEpochEndDate - newVotingPeriodStartDate;
        uint64 newNominationPeriodDuration = currentVotingPeriodStartDate - newNominationPeriodStartDate;

        _configureEpoch(
            epoch,
            currentEpochStartDate,
            newEpochDuration,
            newNominationPeriodDuration,
            newVotingPeriodDuration
        );
    }

    function _configureEpoch(
        EpochData storage epoch,
        uint64 epochStartDate,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) internal {
        _validateEpochSchedule(epochDuration, nominationPeriodDuration, votingPeriodDuration);

        epoch.startDate = epochStartDate;
        epoch.duration = epochDuration;
        epoch.nominationPeriodDuration = nominationPeriodDuration;
        epoch.votingPeriodDuration = votingPeriodDuration;
    }

    function _validateEpochSchedule(
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) private pure {
        // TODO: Make these settings
        /* solhint-disable */
        uint64 _MIN_EPOCH_DURATION = 7 days;
        uint64 _MIN_NOMINATION_PERIOD_DURATION = 2 days;
        uint64 _MIN_VOTING_PERIOD_DURATION = 2 days;
        uint64 _MIN_IDLE_PERIOD_DURATION = 2 days;
        /* solhint-enable */

        if (
            epochDuration < _MIN_EPOCH_DURATION ||
            nominationPeriodDuration < _MIN_NOMINATION_PERIOD_DURATION ||
            votingPeriodDuration < _MIN_VOTING_PERIOD_DURATION
        ) {
            revert InvalidEpochConfiguration();
        }

        if (epochDuration - nominationPeriodDuration - votingPeriodDuration < _MIN_IDLE_PERIOD_DURATION) {
            revert InvalidEpochConfiguration();
        }
    }

    function _uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }

    function _getEpochEndDate(EpochData storage epoch) internal view returns (uint64) {
        return epoch.startDate + epoch.duration;
    }

    function _getVotingPeriodStartDate(EpochData storage epoch) internal view returns (uint64) {
        return epoch.startDate + epoch.duration - epoch.votingPeriodDuration;
    }

    function _getNominationPeriodStartDate(EpochData storage epoch) internal view returns (uint64) {
        return epoch.startDate + epoch.duration - epoch.votingPeriodDuration - epoch.nominationPeriodDuration;
    }
}
