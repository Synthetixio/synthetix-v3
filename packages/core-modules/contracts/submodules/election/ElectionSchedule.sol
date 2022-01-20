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

        if (currentTime >= epoch.endDate) {
            return ElectionPeriod.Evaluation;
        }

        if (currentTime >= epoch.votingPeriodStartDate) {
            return ElectionPeriod.Vote;
        }

        if (currentTime >= epoch.nominationPeriodStartDate) {
            return ElectionPeriod.Nomination;
        }

        return ElectionPeriod.Idle;
    }

    function _configureFirstEpochSchedule(
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        EpochData storage firstEpoch = _getEpochAtPosition(1);

        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpochSchedule(firstEpoch, epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);
    }

    function _configureNextEpochSchedule() internal {
        EpochData storage currentEpoch = _getCurrentEpoch();
        EpochData storage nextEpoch = _getNextEpoch();

        uint64 nextEpochStartDate = uint64(block.timestamp);
        uint64 nextEpochEndDate = nextEpochStartDate + _getEpochDuration(currentEpoch);
        uint64 nextVotingPeriodStartDate = nextEpochEndDate - _getVotingPeriodDuration(currentEpoch);
        uint64 nextNominationPeriodStartDate = nextVotingPeriodStartDate - _getNominationPeriodDuration(currentEpoch);

        _configureEpochSchedule(
            nextEpoch,
            nextEpochStartDate,
            nextNominationPeriodStartDate,
            nextVotingPeriodStartDate,
            nextEpochEndDate
        );
    }

    function _configureEpochSchedule(
        EpochData storage epoch,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        _validateEpochSchedule(epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        epoch.startDate = epochStartDate;
        epoch.nominationPeriodStartDate = nominationPeriodStartDate;
        epoch.votingPeriodStartDate = votingPeriodStartDate;
        epoch.endDate = epochEndDate;
    }

    function _validateEpochSchedule(
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) private pure {
        // TODO: Make these settings
        /* solhint-disable */
        uint64 _MIN_EPOCH_DURATION = 7 days;
        uint64 _MIN_NOMINATION_PERIOD_DURATION = 2 days;
        uint64 _MIN_VOTING_PERIOD_DURATION = 2 days;
        /* solhint-enable */

        // Date order makes sense?
        if (
            epochEndDate <= votingPeriodStartDate ||
            votingPeriodStartDate <= nominationPeriodStartDate ||
            nominationPeriodStartDate <= epochStartDate
        ) {
            revert InvalidEpochConfiguration();
        }

        uint64 epochDuration = epochEndDate - epochStartDate;
        uint64 votingPeriodDuration = epochEndDate - votingPeriodStartDate;
        uint64 nominationPeriodDuration = votingPeriodStartDate - nominationPeriodStartDate;

        // Epoch durations above minimums?
        if (
            epochDuration < _MIN_EPOCH_DURATION ||
            nominationPeriodDuration < _MIN_NOMINATION_PERIOD_DURATION ||
            votingPeriodDuration < _MIN_VOTING_PERIOD_DURATION
        ) {
            revert InvalidEpochConfiguration();
        }
    }

    function _adjustEpochSchedule(
        EpochData storage epoch,
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate,
        bool ensureChangesAreSmall
    ) internal {
        // TODO: Make these settings
        /* solhint-disable */
        uint64 _MAX_EPOCH_DATE_ADJUST = 7 days;
        /* solhint-enable */

        if (ensureChangesAreSmall) {
            if (
                _uint64AbsDifference(newEpochEndDate, epoch.endDate) > _MAX_EPOCH_DATE_ADJUST ||
                _uint64AbsDifference(newNominationPeriodStartDate, epoch.nominationPeriodStartDate) >
                _MAX_EPOCH_DATE_ADJUST ||
                _uint64AbsDifference(newVotingPeriodStartDate, epoch.votingPeriodStartDate) > _MAX_EPOCH_DATE_ADJUST
            ) {
                revert InvalidEpochConfiguration();
            }
        }

        _configureEpochSchedule(
            epoch,
            epoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    function _uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }

    function _getEpochDuration(EpochData storage epoch) private view returns (uint64) {
        return epoch.endDate - epoch.startDate;
    }

    function _getVotingPeriodDuration(EpochData storage epoch) private view returns (uint64) {
        return epoch.endDate - epoch.votingPeriodStartDate;
    }

    function _getNominationPeriodDuration(EpochData storage epoch) private view returns (uint64) {
        return epoch.votingPeriodStartDate - epoch.nominationPeriodStartDate;
    }
}
