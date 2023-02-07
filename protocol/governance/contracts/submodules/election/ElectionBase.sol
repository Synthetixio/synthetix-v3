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
    event EpochStarted(uint epochIndex);
    event CouncilTokenCreated(address proxy, address implementation);
    event CouncilTokenUpgraded(address newImplementation);
    event CouncilMemberAdded(address indexed member, uint indexed epochIndex);
    event CouncilMemberRemoved(address indexed member, uint indexed epochIndex);
    event CouncilMembersDismissed(address[] members, uint indexed epochIndex);
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
    event DefaultBallotEvaluationBatchSizeChanged(uint size);
    event NextEpochSeatCountChanged(uint8 seatCount);
    event MinimumActiveMembersChanged(uint8 minimumActiveMembers);
    event CandidateNominated(address indexed candidate, uint indexed epochIndex);
    event NominationWithdrawn(address indexed candidate, uint indexed epochIndex);
    event VoteRecorded(
        address indexed voter,
        bytes32 indexed ballotId,
        uint indexed epochIndex,
        uint votePower
    );
    event VoteWithdrawn(
        address indexed voter,
        bytes32 indexed ballotId,
        uint indexed epochIndex,
        uint votePower
    );
    event ElectionEvaluated(uint indexed epochIndex, uint totalBallots);
    event ElectionBatchEvaluated(uint indexed epochIndex, uint evaluatedBallots, uint totalBallots);
    event EmergencyElectionStarted(uint indexed epochIndex);
}
