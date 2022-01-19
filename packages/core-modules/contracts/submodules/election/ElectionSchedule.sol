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

        uint64 nextEpochStartDate = uint64(block.timestamp);

        EpochData storage nextEpoch = _getNextEpoch();
        _configureEpoch(
            nextEpoch,
            nextEpochStartDate,
            currentEpoch.duration,
            currentEpoch.nominationPeriodDuration,
            currentEpoch.votingPeriodDuration
        );
    }

    function _configureEpoch(
        EpochData storage epoch,
        uint64 epochStartDate,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) internal {
        _validateEpochSchedule(epochStartDate, epochDuration, nominationPeriodDuration, votingPeriodDuration);

        epoch.startDate = epochStartDate;
        epoch.duration = epochDuration;
        epoch.nominationPeriodDuration = nominationPeriodDuration;
        epoch.votingPeriodDuration = votingPeriodDuration;
    }

    function _validateEpochSchedule(
        uint64 epochStartDate,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) private pure {
        // TODO: Declare these at contract level once deployer is fixed.
        // The deployer does not allow constant declarations in contracts.
        /* solhint-disable */
        uint64 _MIN_EPOCH_DURATION = 7 days;
        uint64 _MIN_NOMINATION_PERIOD_DURATION = 2 days;
        uint64 _MIN_VOTING_PERIOD_DURATION = 2 days;
        /* solhint-enable */

        // Validate minimum durations
        if (
            epochDuration < _MIN_EPOCH_DURATION ||
            nominationPeriodDuration < _MIN_NOMINATION_PERIOD_DURATION ||
            votingPeriodDuration < _MIN_VOTING_PERIOD_DURATION
        ) {
            revert InvalidEpochConfiguration();
        }

        uint64 epochEndDate = epochStartDate + epochDuration;
        uint64 votingPeriodStartDate = epochEndDate - votingPeriodDuration;
        uint64 nominationPeriodStartDate = votingPeriodStartDate - nominationPeriodDuration;

        // Validate order: 0 < epochStartDate < nominationPeriodStartDate < votingPeriodStartDate < epochEndDate
        if (
            epochStartDate == 0 ||
            epochStartDate > nominationPeriodStartDate ||
            nominationPeriodStartDate > votingPeriodStartDate ||
            votingPeriodStartDate > epochEndDate
        ) {
            revert InvalidEpochConfiguration();
        }
    }
}
