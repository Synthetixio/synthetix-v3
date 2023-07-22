//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionSettings.sol";
import "./ElectionBase.sol";

/// @dev Provides funcionality for modifying ElectionSettings
contract ElectionSettingsManager is ElectionBase {
    uint64 private constant _MIN_ELECTION_PERIOD_DURATION = 1 days;

    function _setElectionSettings(
        ElectionSettings.Data storage settings,
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) internal {
        settings.epochSeatCount = epochSeatCount;
        settings.minimumActiveMembers = minimumActiveMembers;
        settings.epochDuration = epochDuration;
        settings.nominationPeriodDuration = nominationPeriodDuration;
        settings.votingPeriodDuration = votingPeriodDuration;
        settings.maxDateAdjustmentTolerance = maxDateAdjustmentTolerance;

        _validateElectionSettings(settings);

        emit ElectionSettingsUpdated(
            settings.epochSeatCount,
            settings.minimumActiveMembers,
            settings.epochDuration,
            settings.nominationPeriodDuration,
            settings.votingPeriodDuration,
            settings.maxDateAdjustmentTolerance
        );
    }

    function _validateElectionSettings(ElectionSettings.Data storage settings) internal view {
        if (
            settings.epochSeatCount == 0 ||
            settings.minimumActiveMembers == 0 ||
            settings.minimumActiveMembers > settings.epochSeatCount ||
            settings.epochDuration == 0 ||
            settings.nominationPeriodDuration == 0 ||
            settings.votingPeriodDuration == 0 ||
            settings.nominationPeriodDuration < _minimumElectionPeriodDuration(settings) ||
            settings.votingPeriodDuration < _minimumElectionPeriodDuration(settings) ||
            settings.epochDuration <
            settings.nominationPeriodDuration + settings.votingPeriodDuration
        ) {
            revert InvalidElectionSettings();
        }
    }

    function _minimumElectionPeriodDuration(
        ElectionSettings.Data storage settings
    ) internal view returns (uint) {
        return _MIN_ELECTION_PERIOD_DURATION + settings.maxDateAdjustmentTolerance;
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
        if (to.epochDuration == 0) {
            to.epochDuration = from.epochDuration;
        }
        if (to.nominationPeriodDuration == 0) {
            to.nominationPeriodDuration = from.nominationPeriodDuration;
        }
        if (to.votingPeriodDuration == 0) {
            to.votingPeriodDuration = from.votingPeriodDuration;
        }
        if (to.maxDateAdjustmentTolerance == 0) {
            to.maxDateAdjustmentTolerance = from.maxDateAdjustmentTolerance;
        }
    }
}
