//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IElectionInspectorModule.sol";
import "../submodules/election/ElectionBase.sol";

/// @title Module that simply adds view functions to retrieve additional info from the election module, such as historical election info
contract ElectionInspectorModule is IElectionInspectorModule, ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    // solhint-disable-next-line no-empty-blocks
    function initializeElectionInspectorModule() external {}

    /// @notice Shows whether the module has been initialized
    /// @dev Since the module requires no initialization, this simply returns true
    function isElectionInspectorModuleInitialized() external pure returns (bool) {
        return true;
    }

    /// @notice Returns the date in which the given epoch started
    function getEpochStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).startDate;
    }

    /// @notice Returns the date in which the given epoch ended
    function getEpochEndDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).endDate;
    }

    /// @notice Returns the date in which the Nomination period in the given epoch started
    function getNominationPeriodStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).nominationPeriodStartDate;
    }

    /// @notice Returns the date in which the Voting period in the given epoch started
    function getVotingPeriodStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).votingPeriodStartDate;
    }

    /// @notice Shows if a candidate was nominated in the given epoch
    function wasNominated(address candidate, uint epochIndex) external view override returns (bool) {
        return _getElectionAtIndex(epochIndex).nominees.contains(candidate);
    }

    /// @notice Returns a list of all nominated candidates in the given epoch
    function getNomineesAtEpoch(uint epochIndex) external view override returns (address[] memory) {
        return _getElectionAtIndex(epochIndex).nominees.values();
    }

    /// @notice Returns the ballot id that user voted on in the given election
    function getBallotVotedAtEpoch(address user, uint epochIndex) public view override returns (bytes32) {
        return _getElectionAtIndex(epochIndex).ballotIdsByAddress[user];
    }

    /// @notice Returns if user has voted in the given election
    function hasVotedInEpoch(address user, uint epochIndex) external view override returns (bool) {
        return getBallotVotedAtEpoch(user, epochIndex) != bytes32(0);
    }

    /// @notice Returns the number of votes given to a particular ballot in a given epoch
    function getBallotVotesInEpoch(bytes32 ballotId, uint epochIndex) external view override returns (uint) {
        return _getBallotInEpoch(ballotId, epochIndex).votes;
    }

    /// @notice Returns the list of candidates that a particular ballot has in a given epoch
    function getBallotCandidatesInEpoch(bytes32 ballotId, uint epochIndex)
        external
        view
        override
        returns (address[] memory)
    {
        return _getBallotInEpoch(ballotId, epochIndex).candidates;
    }

    /// @notice Returns the number of votes a candidate received in a given epoch
    function getCandidateVotesInEpoch(address candidate, uint epochIndex) external view override returns (uint) {
        return _getElectionAtIndex(epochIndex).candidateVotes[candidate];
    }

    /// @notice Returns the winners of the given election
    function getElectionWinnersInEpoch(uint epochIndex) external view override returns (address[] memory) {
        return _getElectionAtIndex(epochIndex).winners.values();
    }

    /// @notice Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated
    function getCandidateVotes(address candidate) external view override returns (uint) {
        return _getCurrentElection().candidateVotes[candidate];
    }

    /// @notice Returns the winners of the current election. Requires the election to be partially or totally evaluated
    function getElectionWinners() external view override returns (address[] memory) {
        return _getCurrentElection().winners.values();
    }

    /// @notice Returns the current NFT token holders
    function getCouncilMembers() external view override returns (address[] memory) {
        return _electionStore().councilMembers.values();
    }

    /// @notice Hashes a list of candidates (used for identifying and storing ballots)
    function calculateBallotId(address[] calldata candidates) external pure override returns (bytes32) {
        return _calculateBallotId(candidates);
    }

    /// @notice Exposes minimum durations required when adjusting epoch schedules
    function getMinEpochDurations()
        external
        view
        override
        returns (
            uint64 minNominationPeriodDuration,
            uint64 minVotingPeriodDuration,
            uint64 minEpochDuration
        )
    {
        ElectionSettings storage settings = _electionSettings();

        return (settings.minNominationPeriodDuration, settings.minVotingPeriodDuration, settings.minEpochDuration);
    }

    /// @notice Exposes maximum size of adjustments when calling tweakEpochSchedule
    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return _electionSettings().maxDateAdjustmentTolerance;
    }

    /// @notice Shows the default batch size when calling evaluate() with numBallots = 0
    function getDefaultBallotEvaluationBatchSize() external view override returns (uint) {
        return _electionSettings().defaultBallotEvaluationBatchSize;
    }

    /// @notice Shows the number of council members that the next epoch will have
    function getNextEpochSeatCount() external view override returns (uint8) {
        return _electionSettings().nextEpochSeatCount;
    }

    /// @notice Returns the minimum active members that the council needs to avoid an emergency election
    function getMinimumActiveMembers() external view override returns (uint8) {
        return _electionSettings().minimumActiveMembers;
    }

    /// @notice Returns the index of the current epoch. The first epoch's index is 1
    function getEpochIndex() external view override returns (uint) {
        return _getCurrentEpochIndex();
    }

    /// @notice Returns the date in which the current epoch started
    function getEpochStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    /// @notice Returns the date in which the current epoch will end
    function getEpochEndDate() external view override returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    /// @notice Returns the date in which the Nomination period in the current epoch will start
    function getNominationPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    /// @notice Returns the date in which the Voting period in the current epoch will start
    function getVotingPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    /// @notice Returns the number of votes given to a particular ballot
    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
        return _getBallot(ballotId).votes;
    }

    /// @notice Returns the list of candidates that a particular ballot has
    function getBallotCandidates(bytes32 ballotId) external view override returns (address[] memory) {
        return _getBallot(ballotId).candidates;
    }

    /// @notice Returns the current period type: Administration, Nomination, Voting, Evaluation
    function getCurrentPeriod() external view override returns (uint) {
        return uint(_getCurrentPeriod());
    }

    /// @notice Returns the address of the council NFT token
    function getCouncilToken() public view override returns (address) {
        return _electionStore().councilToken;
    }

    /// @notice Returns if user has voted in the current election
    function hasVoted(address user) public view override returns (bool) {
        return _hasVoted(user);
    }

    /// @notice Returns whether all ballots in the current election have been counted
    function isElectionEvaluated() public view override returns (bool) {
        return _getCurrentElection().evaluated;
    }

    /// @notice Returns the ballot id that user voted on in the current election
    function getBallotVoted(address user) public view override returns (bytes32) {
        return _getBallotVoted(user);
    }

    /// @notice Returns a list of all nominated candidates in the current epoch
    function getNominees() external view override returns (address[] memory) {
        return _getCurrentElection().nominees.values();
    }

    /// @notice Shows if a candidate has been nominated in the current epoch
    function isNominated(address candidate) external view override returns (bool) {
        return _getCurrentElection().nominees.contains(candidate);
    }
}
