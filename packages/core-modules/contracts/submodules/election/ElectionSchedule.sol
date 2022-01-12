//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionSchedule is ElectionBase {
    error InvalidEpochConfiguration();
    error NotCallableInCurrentStatus();

    modifier onlyWithStatus(EpochStatus status) {
        if (getEpochStatus() != status) {
            revert NotCallableInCurrentStatus();
        }

        _;
    }

    function getEpochStatus() public view returns (EpochStatus) {
        EpochData storage epoch = _getCurrentEpoch();

        uint64 currentTime = uint64(block.timestamp);

        if (currentTime >= epoch.endDate) {
            return EpochStatus.Evaluating;
        }

        if (currentTime >= epoch.votingPeriodStartDate) {
            return EpochStatus.Voting;
        }

        if (currentTime >= epoch.nominationPeriodStartDate) {
            return EpochStatus.Nominating;
        }

        return EpochStatus.Idle;
    }

    function _configureFirstEpoch(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) internal {
        EpochData storage firstEpoch = _getEpochAtPosition(1);

        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpoch(firstEpoch, epochStartDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    function _configureNextEpoch() internal {
        EpochData storage currentEpoch = _getCurrentEpoch();

        uint64 epochDuration = currentEpoch.endDate - currentEpoch.startDate;
        uint64 votingPeriodDuration = currentEpoch.endDate - currentEpoch.votingPeriodStartDate;
        uint64 nominationPeriodDuration = currentEpoch.votingPeriodStartDate - currentEpoch.nominationPeriodStartDate;

        uint64 nextEpochStartDate = uint64(block.timestamp);
        uint64 nextEpochEndDate = nextEpochStartDate + epochDuration;
        uint64 nextVotingPeriodStartDate = nextEpochEndDate - votingPeriodDuration;
        uint64 nextNominationPeriodStartDate = nextVotingPeriodStartDate - nominationPeriodDuration;

        EpochData storage nextEpoch = _getNextEpoch();
        _configureEpoch(
            nextEpoch,
            nextEpochStartDate,
            nextEpochEndDate,
            nextNominationPeriodStartDate,
            nextVotingPeriodStartDate
        );
    }

    function _configureEpoch(
        EpochData storage epoch,
        uint64 epochStartDate,
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) internal {
        _validateEpochDates(epochStartDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);

        epoch.startDate = epochStartDate;
        epoch.endDate = epochEndDate;
        epoch.nominationPeriodStartDate = nominationPeriodStartDate;
        epoch.votingPeriodStartDate = votingPeriodStartDate;
    }

    function _validateEpochDates(
        uint64 epochStartDate,
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) private pure {
        // TODO: Declare these at contract level once deployer is fixed.
        // The deployer does not allow constant declarations in contracts.
        /* solhint-disable */
        uint64 _MIN_EPOCH_DURATION = 7 days;
        uint64 _MIN_NOMINATION_PERIOD_DURATION = 1 days;
        uint64 _MIN_VOTING_PERIOD_DURATION = 1 days;
        /* solhint-enable */

        // Validate order: 0 < epochStartDate < nominationPeriodStartDate < votingPeriodStartDate < epochEndDate
        if (
            epochStartDate == 0 ||
            epochStartDate > nominationPeriodStartDate ||
            nominationPeriodStartDate > votingPeriodStartDate ||
            votingPeriodStartDate > epochEndDate
        ) {
            revert InvalidEpochConfiguration();
        }

        // Validate minimum durations
        uint64 epochDuration = epochEndDate - epochStartDate;
        uint64 votingPeriodDuration = epochEndDate - votingPeriodStartDate;
        uint64 nominationPeriodDuration = votingPeriodStartDate - nominationPeriodStartDate;
        if (
            epochDuration < _MIN_EPOCH_DURATION ||
            nominationPeriodDuration < _MIN_NOMINATION_PERIOD_DURATION ||
            votingPeriodDuration < _MIN_VOTING_PERIOD_DURATION
        ) {
            revert InvalidEpochConfiguration();
        }
    }
}
