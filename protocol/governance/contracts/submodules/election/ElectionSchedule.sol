//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "./ElectionBase.sol";

/// @dev Provides core schedule functionality. I.e. dates, periods, etc
contract ElectionSchedule is ElectionBase {
    using Council for Council.Data;
    using SafeCastU256 for uint256;

    /// @dev Used to allow certain functions to only operate within a given period
    modifier onlyInPeriod(Council.ElectionPeriod period) {
        if (Council.load().getCurrentPeriod() != period) {
            revert NotCallableInCurrentPeriod();
        }

        _;
    }

    /// @dev Sets dates within an epoch, with validations
    function _configureEpochSchedule(
        Epoch.Data storage epoch,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        _validateEpochSchedule(
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        epoch.startDate = epochStartDate;
        epoch.nominationPeriodStartDate = nominationPeriodStartDate;
        epoch.votingPeriodStartDate = votingPeriodStartDate;
        epoch.endDate = epochEndDate;
    }

    /// @dev Ensures epoch dates are in the correct order, durations are above minimums, etc
    function _validateEpochSchedule(
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) private view {
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

        ElectionSettings.Data storage settings = Council.load().getCurrentElectionSettings();

        if (
            epochDuration < settings.nominationPeriodDuration + settings.votingPeriodDuration ||
            nominationPeriodDuration < settings.nominationPeriodDuration ||
            votingPeriodDuration < settings.votingPeriodDuration
        ) {
            revert InvalidEpochConfiguration();
        }
    }

    /// @dev Changes epoch dates, with validations
    function _adjustEpochSchedule(
        Epoch.Data storage epoch,
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate,
        bool ensureChangesAreSmall
    ) internal {
        Council.Data storage store = Council.load();

        if (ensureChangesAreSmall) {
            ElectionSettings.Data storage settings = store.getCurrentElectionSettings();

            if (
                _uint64AbsDifference(newEpochEndDate, epoch.startDate + settings.epochDuration) >
                settings.maxDateAdjustmentTolerance ||
                _uint64AbsDifference(
                    newNominationPeriodStartDate,
                    epoch.nominationPeriodStartDate
                ) >
                settings.maxDateAdjustmentTolerance ||
                _uint64AbsDifference(newVotingPeriodStartDate, epoch.votingPeriodStartDate) >
                settings.maxDateAdjustmentTolerance
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

        if (store.getCurrentPeriod() != Council.ElectionPeriod.Administration) {
            revert ChangesCurrentPeriod();
        }
    }

    /// @dev Moves schedule forward to immediately jump to the nomination period
    function _jumpToNominationPeriod() internal {
        Council.Data storage store = Council.load();
        Epoch.Data storage currentEpoch = store.getCurrentElection().epoch;
        ElectionSettings.Data storage settings = store.getCurrentElectionSettings();

        // Keep the previous durations, but shift everything back
        // so that nominations start now
        uint64 newNominationPeriodStartDate = block.timestamp.to64();
        uint64 newVotingPeriodStartDate = newNominationPeriodStartDate +
            settings.nominationPeriodDuration;
        uint64 newEpochEndDate = newVotingPeriodStartDate + settings.votingPeriodDuration;

        _configureEpochSchedule(
            currentEpoch,
            currentEpoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    function _initScheduleFromSettings() internal {
        Council.Data storage store = Council.load();
        ElectionSettings.Data storage settings = store.getCurrentElectionSettings();

        uint64 currentEpochStartDate = block.timestamp.to64();
        uint64 currentEpochEndDate = currentEpochStartDate + settings.epochDuration;
        uint64 currentVotingPeriodStartDate = currentEpochEndDate - settings.votingPeriodDuration;
        uint64 currentNominationPeriodStartDate = currentVotingPeriodStartDate -
            settings.nominationPeriodDuration;

        _configureEpochSchedule(
            store.getCurrentElection().epoch,
            currentEpochStartDate,
            currentNominationPeriodStartDate,
            currentVotingPeriodStartDate,
            currentEpochEndDate
        );
    }

    function _uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }
}
