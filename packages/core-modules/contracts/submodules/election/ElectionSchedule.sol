//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionSchedule is ElectionBase {
    // ---------------------------------------
    // ElectionPeriod type enum
    // ---------------------------------------

    modifier onlyInPeriod(ElectionPeriod period) {
        if (_getCurrentPeriodType() != period) {
            revert NotCallableInCurrentPeriod();
        }

        _;
    }

    function _getCurrentPeriodType() internal view returns (ElectionPeriod) {
        if (!_electionStore().initialized) {
            return ElectionPeriod.Null;
        }

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

    // ---------------------------------------
    // Epoch and period configurations
    // ---------------------------------------

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
    ) private view {
        // Ensure date order makes sense
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

        ElectionModuleSettings storage settings = _electionStore().settings;

        // Ensure all durations are above minimums
        if (
            epochDuration < settings.minEpochDuration ||
            nominationPeriodDuration < settings.minNominationPeriodDuration ||
            votingPeriodDuration < settings.minVotingPeriodDuration
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
        uint64 maxDateAdjustmentTolerance = _electionStore().settings.maxDateAdjustmentTolerance;
        if (ensureChangesAreSmall) {
            if (
                _uint64AbsDifference(newEpochEndDate, epoch.endDate) > maxDateAdjustmentTolerance ||
                _uint64AbsDifference(newNominationPeriodStartDate, epoch.nominationPeriodStartDate) >
                maxDateAdjustmentTolerance ||
                _uint64AbsDifference(newVotingPeriodStartDate, epoch.votingPeriodStartDate) > maxDateAdjustmentTolerance
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

    // ---------------------------------------
    // Settings
    // ---------------------------------------

    function _setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) internal {
        ElectionModuleSettings storage settings = _electionStore().settings;

        if (newMinNominationPeriodDuration == 0 || newMinVotingPeriodDuration == 0 || newMinEpochDuration == 0) {
            revert InvalidElectionSettings();
        }

        settings.minNominationPeriodDuration = newMinNominationPeriodDuration;
        settings.minVotingPeriodDuration = newMinVotingPeriodDuration;
        settings.minEpochDuration = newMinEpochDuration;
    }

    function _setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) internal {
        if (newMaxDateAdjustmentTolerance == 0) {
            revert InvalidElectionSettings();
        }

        _electionStore().settings.maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;
    }

    // ---------------------------------------
    // Utilities
    // ---------------------------------------

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
