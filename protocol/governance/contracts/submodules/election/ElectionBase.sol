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
    error ChangesCurrentPeriod();
    error AlreadyACouncilMember();
    error NotACouncilMember();
    error NotMothership();

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
    event ElectionSettingsUpdated(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    );
    event CandidateNominated(address indexed candidate, uint indexed epochIndex);
    event NominationWithdrawn(address indexed candidate, uint indexed epochIndex);
    event VoteRecorded(
        address indexed voter,
        uint256 indexed ballotId,
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
    event MothershipChainIdUpdated(uint indexed mothershipChainId);
}
