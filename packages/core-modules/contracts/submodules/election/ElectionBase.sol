//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the ElectionModule
contract ElectionBase is ElectionStorage {
    // ---------------------------------------
    // Enums
    // ---------------------------------------

    enum ElectionPeriod {
        // Council elected and active
        Administration,
        // Accepting nominations for next election
        Nomination,
        // Accepting votes for ongoing election
        Vote,
        // Votes being counted
        Evaluation
    }

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
    event EpochScheduleUpdated(uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate);
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
    event VoteRecorded(address indexed voter, bytes32 indexed ballotId, uint indexed epochIndex, uint votePower);
    event VoteWithdrawn(address indexed voter, bytes32 indexed ballotId, uint indexed epochIndex, uint votePower);
    event ElectionEvaluated(uint indexed epochIndex, uint totalBallots);
    event ElectionBatchEvaluated(uint indexed epochIndex, uint evaluatedBallots, uint totalBallots);
    event EmergencyElectionStarted(uint indexed epochIndex);

    // ---------------------------------------
    // Helpers
    // ---------------------------------------

    function _createNewEpoch() internal virtual {
        ElectionStore storage store = _electionStore();

        store.epochs.push();
        store.elections.push();
    }

    function _getCurrentEpochIndex() internal view returns (uint) {
        return _electionStore().epochs.length - 1;
    }

    function _getCurrentEpoch() internal view returns (EpochData storage) {
        return _getEpochAtIndex(_getCurrentEpochIndex());
    }

    function _getPreviousEpoch() internal view returns (EpochData storage) {
        return _getEpochAtIndex(_getCurrentEpochIndex() - 1);
    }

    function _getEpochAtIndex(uint epochIndex) internal view returns (EpochData storage) {
        return _electionStore().epochs[epochIndex];
    }

    function _getCurrentElection() internal view returns (ElectionData storage) {
        return _getElectionAtIndex(_getCurrentEpochIndex());
    }

    function _getElectionAtIndex(uint epochIndex) internal view returns (ElectionData storage) {
        return _electionStore().elections[epochIndex];
    }

    function _getBallot(bytes32 ballotId) internal view returns (BallotData storage) {
        return _getCurrentElection().ballotsById[ballotId];
    }

    function _getBallotInEpoch(bytes32 ballotId, uint epochIndex) internal view returns (BallotData storage) {
        return _getElectionAtIndex(epochIndex).ballotsById[ballotId];
    }

    function _calculateBallotId(address[] memory candidates) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(candidates));
    }

    function _ballotExists(BallotData storage ballot) internal view returns (bool) {
        return ballot.candidates.length != 0;
    }

    function _getBallotVoted(address user) internal view returns (bytes32) {
        return _getCurrentElection().ballotIdsByAddress[user];
    }
}
