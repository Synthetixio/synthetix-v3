//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ElectionBase.sol";

contract ElectionSchedule is ElectionBase {
    error InvalidEpochConfiguration();
    error OnlyCallableWhileNominating();
    error OnlyCallableWhileVoting();
    error OnlyCallableWhileEvaluating();

    modifier onlyWhileNominating() {
        if (getEpochStatus() != EpochStatus.Nominating) {
            revert OnlyCallableWhileNominating();
        }

        _;
    }

    modifier onlyWhileVoting() {
        if (getEpochStatus() != EpochStatus.Voting) {
            revert OnlyCallableWhileVoting();
        }

        _;
    }

    modifier onlyWhileEvaluating() {
        if (getEpochStatus() != EpochStatus.Evaluating) {
            revert OnlyCallableWhileEvaluating();
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
        /* solhint-disable private-vars-leading-underscore */
        /* solhint-disable var-name-mixedcase */
        uint64 _MIN_EPOCH_DURATION = 7 days;
        uint64 _MIN_NOMINATION_PERIOD_DURATION = 1 days;
        uint64 _MIN_VOTING_PERIOD_DURATION = 1 days;
        /* solhint-enable private-vars-leading-underscore */
        /* solhint-enable var-name-mixedcase */

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
