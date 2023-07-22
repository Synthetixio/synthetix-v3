//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionSettings.sol";
import "./ElectionBase.sol";

/// @dev Provides funcionality for modifying ElectionSettings
contract ElectionSettingsManager is ElectionBase {
    function _setElectionSettings(
        ElectionSettings.Data storage settings,
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 minEpochDuration,
        uint64 minNominationPeriodDuration,
        uint64 minVotingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) internal {
        if (epochSeatCount > 0) {
            settings.epochSeatCount = epochSeatCount;
        }

        if (minimumActiveMembers > 0) {
            settings.minimumActiveMembers = minimumActiveMembers;
        }

        if (epochDuration > 0) {
            settings.epochDuration = epochDuration;
        }

        if (minEpochDuration > 0) {
            settings.minEpochDuration = minEpochDuration;
        }

        if (minNominationPeriodDuration > 0) {
            settings.minNominationPeriodDuration = minNominationPeriodDuration;
        }

        if (minVotingPeriodDuration > 0) {
            settings.minVotingPeriodDuration = minVotingPeriodDuration;
        }

        if (maxDateAdjustmentTolerance > 0) {
            settings.maxDateAdjustmentTolerance = maxDateAdjustmentTolerance;
        }

        _validateElectionSettings(settings);

        emit ElectionSettingsUpdated(
            settings.epochSeatCount,
            settings.minimumActiveMembers,
            settings.epochDuration,
            settings.minEpochDuration,
            settings.minNominationPeriodDuration,
            settings.minVotingPeriodDuration,
            settings.maxDateAdjustmentTolerance
        );
    }

    function _validateElectionSettings(ElectionSettings.Data storage settings) internal view {
        if (
            settings.minimumActiveMembers == 0 ||
            settings.minimumActiveMembers > settings.epochSeatCount ||
            settings.epochDuration == 0 ||
            settings.epochDuration < settings.minEpochDuration ||
            settings.minEpochDuration <
            settings.minNominationPeriodDuration + settings.minVotingPeriodDuration
        ) {
            revert InvalidElectionSettings();
        }
    }

    function _copyMissingSettings(
        ElectionSettings.Data storage from,
        ElectionSettings.Data storage to
    ) internal {
        if (to.epochSeatCount == 0) {
            to.epochSeatCount = from.epochSeatCount;
        }
        if (to.minimumActiveMembers == 0) {
            to.minimumActiveMembers = from.minimumActiveMembers;
        }
        if (to.minEpochDuration == 0) {
            to.minEpochDuration = from.minEpochDuration;
        }
        if (to.epochDuration == 0) {
            to.epochDuration = from.epochDuration;
        }
        if (to.minNominationPeriodDuration == 0) {
            to.minNominationPeriodDuration = from.minNominationPeriodDuration;
        }
        if (to.minVotingPeriodDuration == 0) {
            to.minVotingPeriodDuration = from.minVotingPeriodDuration;
        }
        if (to.maxDateAdjustmentTolerance == 0) {
            to.maxDateAdjustmentTolerance = from.maxDateAdjustmentTolerance;
        }
    }
}
