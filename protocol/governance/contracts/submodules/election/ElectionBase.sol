//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/Council.sol";
import "../../storage/Election.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the ElectionModule
contract ElectionBase {
    // ---------------------------------------
    // Errors
    // ---------------------------------------

    error ElectionNotEvaluated();
    error ElectionAlreadyEvaluated();
    error AlreadyNominated();
    error NotNominated();
    error NoCandidates();
    error NoVotePower();
    error VoteNotCasted();
    error DuplicateCandidates();
    error InvalidEpochConfiguration();
    error InvalidElectionSettings();
    error NotCallableInCurrentPeriod();
    error ChangesCurrentPeriod();
    error AlreadyACouncilMember();
    error NotACouncilMember();
    error InvalidMinimumActiveMembers();

    // ---------------------------------------
    // Events
    // ---------------------------------------

    event ElectionModuleInitialized();
    event EpochStarted(uint256 epochIndex);
    event CouncilTokenCreated(address proxy, address implementation);
    event CouncilTokenUpgraded(address newImplementation);
    event CouncilMemberAdded(address indexed member, uint256 indexed epochIndex);
    event CouncilMemberRemoved(address indexed member, uint256 indexed epochIndex);
    event CouncilMembersDismissed(address[] members, uint256 indexed epochIndex);
    event EpochScheduleUpdated(
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    );
    event MinimumEpochDurationsChanged(
        uint64 minNominationPeriodDuration,
        uint64 minVotingPeriodDuration,
        uint64 minEpochDuration
    );
    event MaxDateAdjustmentToleranceChanged(uint64 tolerance);
    event DefaultBallotEvaluationBatchSizeChanged(uint256 size);
    event NextEpochSeatCountChanged(uint8 seatCount);
    event MinimumActiveMembersChanged(uint8 minimumActiveMembers);
    event CandidateNominated(address indexed candidate, uint256 indexed epochIndex);
    event NominationWithdrawn(address indexed candidate, uint256 indexed epochIndex);
    event VoteRecorded(
        address indexed voter,
        bytes32 indexed ballotId,
        uint256 indexed epochIndex,
        uint256 votePower
    );
    event VoteWithdrawn(
        address indexed voter,
        bytes32 indexed ballotId,
        uint256 indexed epochIndex,
        uint256 votePower
    );
    event ElectionEvaluated(uint256 indexed epochIndex, uint256 totalBallots);
    event ElectionBatchEvaluated(
        uint256 indexed epochIndex,
        uint256 evaluatedBallots,
        uint256 totalBallots
    );
    event EmergencyElectionStarted(uint256 indexed epochIndex);
}
