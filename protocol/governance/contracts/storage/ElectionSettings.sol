//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ElectionSettings {
    event ElectionSettingsUpdated(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    );
    error InvalidElectionSettings();

    struct Data {
        // Number of council members in the current epoch
        uint8 epochSeatCount;
        // Minimum active council members. If too many are dismissed an emergency election is triggered
        uint8 minimumActiveMembers;
        // Expected duration of the epoch
        uint64 epochDuration;
        // Expected nomination period duration
        uint64 nominationPeriodDuration;
        // Expected voting period duration
        uint64 votingPeriodDuration;
        // Maximum size for tweaking epoch schedules (see tweakEpochSchedule)
        uint64 maxDateAdjustmentTolerance;
    }

    function load(uint256 epochIndex) internal pure returns (Data storage settings) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.ElectionSettings", epochIndex));
        assembly {
            settings.slot := s
        }
    }

    /// @dev Minimum duration for Nomination and Voting periods, making sure that
    /// they cannot be "deleted" by the current council
    uint64 private constant _MIN_ELECTION_PERIOD_DURATION = 1 days;

    function setElectionSettings(
        Data storage settings,
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

        validate(settings);

        emit ElectionSettingsUpdated(
            settings.epochSeatCount,
            settings.minimumActiveMembers,
            settings.epochDuration,
            settings.nominationPeriodDuration,
            settings.votingPeriodDuration,
            settings.maxDateAdjustmentTolerance
        );
    }

    function validate(Data storage settings) internal view {
        if (
            settings.epochSeatCount == 0 ||
            settings.minimumActiveMembers == 0 ||
            settings.minimumActiveMembers > settings.epochSeatCount ||
            settings.epochDuration == 0 ||
            settings.nominationPeriodDuration == 0 ||
            settings.votingPeriodDuration == 0 ||
            settings.nominationPeriodDuration < minimumElectionPeriodDuration(settings) ||
            settings.votingPeriodDuration < minimumElectionPeriodDuration(settings) ||
            settings.epochDuration <
            settings.nominationPeriodDuration + settings.votingPeriodDuration
        ) {
            revert InvalidElectionSettings();
        }
    }

    function minimumElectionPeriodDuration(Data storage settings) internal view returns (uint256) {
        return _MIN_ELECTION_PERIOD_DURATION + settings.maxDateAdjustmentTolerance;
    }

    function copyMissingFrom(Data storage to, Data storage from) internal {
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
