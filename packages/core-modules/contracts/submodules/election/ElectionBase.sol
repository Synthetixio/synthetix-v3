//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../../storage/ElectionStorage.sol";

/// @dev Common utils, errors, and events to be used by any contracts that conform the ElectionModule
contract ElectionBase is ElectionStorage, InitializableMixin {
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
    event CouncilMemberRemoved(address indexed member);
    event CouncilMembersDismissed(address[] members);
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
    event CandidateNominated(address indexed candidate);
    event NominationWithdrawn(address indexed candidate);
    event VoteRecorded(address indexed voter, bytes32 indexed ballotId, uint votePower);
    event VoteWithdrawn(address indexed voter, bytes32 indexed ballotId, uint votePower);
    event ElectionEvaluated(uint indexed epochIndex, uint totalBallots);
    event ElectionBatchEvaluated(uint indexed epochIndex, uint evaluatedBallots, uint totalBallots);
    event EmergencyElectionStarted();

    // ---------------------------------------
    // Helpers
    // ---------------------------------------

    function _isInitialized() internal view override returns (bool) {
        return _electionStore().initialized;
    }

    function _createNewEpoch() internal virtual {
        ElectionStore storage store = _electionStore();

        store.epochs.push();
        store.elections.push();
    }

    function _getCurrentEpochIndex() internal view returns (uint) {
        return _electionStore().epochs.length - 1;
    }

    function _getCurrentEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_getCurrentEpochIndex());
    }

    function _getLastEpoch() internal view returns (EpochData storage) {
        return _getEpochAtPosition(_getCurrentEpochIndex() - 1);
    }

    function _getEpochAtPosition(uint position) internal view returns (EpochData storage) {
        return _electionStore().epochs[position];
    }

    function _getCurrentElection() internal view returns (ElectionData storage) {
        return _getElectionAtPosition(_getCurrentEpochIndex());
    }

    function _getElectionAtPosition(uint position) internal view returns (ElectionData storage) {
        return _electionStore().elections[position];
    }

    function _getBallot(bytes32 ballotId) internal view returns (BallotData storage) {
        return _getCurrentElection().ballotsById[ballotId];
    }

    function _calculateBallotId(address[] memory candidates) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(candidates));
    }

    function _ballotExists(BallotData storage ballot) internal view returns (bool) {
        return ballot.candidates.length != 0;
    }
}
