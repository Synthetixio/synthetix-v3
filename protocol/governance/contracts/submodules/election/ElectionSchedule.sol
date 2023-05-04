//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

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

        ElectionSettings.Data storage settings = Council.load().nextElectionSettings;

        if (
            epochDuration < settings.minEpochDuration ||
            nominationPeriodDuration < settings.minNominationPeriodDuration ||
            votingPeriodDuration < settings.minVotingPeriodDuration
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
        uint64 maxDateAdjustmentTolerance = Council
            .load()
            .nextElectionSettings
            .maxDateAdjustmentTolerance;

        if (ensureChangesAreSmall) {
            if (
                _uint64AbsDifference(newEpochEndDate, epoch.endDate) > maxDateAdjustmentTolerance ||
                _uint64AbsDifference(
                    newNominationPeriodStartDate,
                    epoch.nominationPeriodStartDate
                ) >
                maxDateAdjustmentTolerance ||
                _uint64AbsDifference(newVotingPeriodStartDate, epoch.votingPeriodStartDate) >
                maxDateAdjustmentTolerance
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

        if (Council.load().getCurrentPeriod() != Council.ElectionPeriod.Administration) {
            revert ChangesCurrentPeriod();
        }
    }

    /// @dev Moves schedule forward to immediately jump to the nomination period
    function _jumpToNominationPeriod() internal {
        Epoch.Data storage currentEpoch = Council.load().getCurrentElection().epoch;

        uint64 nominationPeriodDuration = _getNominationPeriodDuration(currentEpoch);
        uint64 votingPeriodDuration = _getVotingPeriodDuration(currentEpoch);

        // Keep the previous durations, but shift everything back
        // so that nominations start now
        uint64 newNominationPeriodStartDate = block.timestamp.to64();
        uint64 newVotingPeriodStartDate = newNominationPeriodStartDate + nominationPeriodDuration;
        uint64 newEpochEndDate = newVotingPeriodStartDate + votingPeriodDuration;

        _configureEpochSchedule(
            currentEpoch,
            currentEpoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    /// @dev Copies the current epoch schedule to the next epoch, maintaining durations
    function _copyScheduleFromPreviousEpoch() internal {
        Epoch.Data storage previousEpoch = Council.load().getPreviousElection().epoch;
        Epoch.Data storage currentEpoch = Council.load().getCurrentElection().epoch;

        uint64 currentEpochStartDate = block.timestamp.to64();
        uint64 currentEpochEndDate = currentEpochStartDate + _getEpochDuration(previousEpoch);
        uint64 currentVotingPeriodStartDate = currentEpochEndDate -
            _getVotingPeriodDuration(previousEpoch);
        uint64 currentNominationPeriodStartDate = currentVotingPeriodStartDate -
            _getNominationPeriodDuration(previousEpoch);

        _configureEpochSchedule(
            currentEpoch,
            currentEpochStartDate,
            currentNominationPeriodStartDate,
            currentVotingPeriodStartDate,
            currentEpochEndDate
        );
    }

    /// @dev Sets the minimum epoch durations, with validations
    function _setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) internal {
        ElectionSettings.Data storage settings = Council.load().nextElectionSettings;

        if (
            newMinNominationPeriodDuration == 0 ||
            newMinVotingPeriodDuration == 0 ||
            newMinEpochDuration == 0
        ) {
            revert InvalidElectionSettings();
        }

        settings.minNominationPeriodDuration = newMinNominationPeriodDuration;
        settings.minVotingPeriodDuration = newMinVotingPeriodDuration;
        settings.minEpochDuration = newMinEpochDuration;
    }

    function _uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }

    function _getEpochDuration(Epoch.Data storage epoch) private view returns (uint64) {
        return epoch.endDate - epoch.startDate;
    }

    function _getVotingPeriodDuration(Epoch.Data storage epoch) private view returns (uint64) {
        return epoch.endDate - epoch.votingPeriodStartDate;
    }

    function _getNominationPeriodDuration(Epoch.Data storage epoch) private view returns (uint64) {
        return epoch.votingPeriodStartDate - epoch.nominationPeriodStartDate;
    }
}
