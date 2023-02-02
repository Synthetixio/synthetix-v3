//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for electing a council, represented by a set of NFT holders
interface IElectionModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    /// @notice Initializes the module and immediately starts the first epoch
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external;

    /// @notice Shows whether the module has been initialized
    function isElectionModuleInitialized() external view returns (bool);

    // ---------------------------------------
    // Owner write functions
    // ---------------------------------------

    /// @notice Adjusts the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)
    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

    /// @notice Adjusts the current epoch schedule requiring that the current period remains Administration
    function modifyEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

    /// @notice Determines minimum values for epoch schedule adjustments
    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external;

    /// @notice Determines adjustment size for tweakEpochSchedule
    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external;

    /// @notice Determines batch size when evaluate() is called with numBallots = 0
    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external;

    /// @notice Determines the number of council members in the next epoch
    function setNextEpochSeatCount(uint8 newSeatCount) external;

    /// @notice Determines the minimum number of council members before triggering an emergency election
    function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external;

    /// @notice Allows the owner to remove one or more council members, triggering an election if a threshold is met
    function dismissMembers(address[] calldata members) external;

    // ---------------------------------------
    // User write functions
    // ---------------------------------------

    /// @notice Allows anyone to self-nominate during the Nomination period
    function nominate() external;

    /// @notice Self-withdrawal of nominations during the Nomination period
    function withdrawNomination() external;

    /// @notice Allows anyone with vote power to vote on nominated candidates during the Voting period
    function cast(address[] calldata candidates) external;

    /// @notice Allows votes to be withdraw
    function withdrawVote() external;

    /// @notice Processes ballots in batches during the Evaluation period (after epochEndDate)
    function evaluate(uint numBallots) external;

    /// @notice Shuffles NFTs and resolves an election after it has been evaluated
    function resolve() external;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    /// @notice Exposes minimum durations required when adjusting epoch schedules
    function getMinEpochDurations()
        external
        view
        returns (
            uint64 minNominationPeriodDuration,
            uint64 minVotingPeriodDuration,
            uint64 minEpochDuration
        );

    /// @notice Exposes maximum size of adjustments when calling tweakEpochSchedule
    function getMaxDateAdjustmenTolerance() external view returns (uint64);

    /// @notice Shows the default batch size when calling evaluate() with numBallots = 0
    function getDefaultBallotEvaluationBatchSize() external view returns (uint);

    /// @notice Shows the number of council members that the next epoch will have
    function getNextEpochSeatCount() external view returns (uint8);

    /// @notice Returns the minimum active members that the council needs to avoid an emergency election
    function getMinimumActiveMembers() external view returns (uint8);

    /// @notice Returns the index of the current epoch. The first epoch's index is 1
    function getEpochIndex() external view returns (uint);

    /// @notice Returns the date in which the current epoch started
    function getEpochStartDate() external view returns (uint64);

    /// @notice Returns the date in which the current epoch will end
    function getEpochEndDate() external view returns (uint64);

    /// @notice Returns the date in which the Nomination period in the current epoch will start
    function getNominationPeriodStartDate() external view returns (uint64);

    /// @notice Returns the date in which the Voting period in the current epoch will start
    function getVotingPeriodStartDate() external view returns (uint64);

    /// @notice Returns the current period type: Administration, Nomination, Voting, Evaluation
    function getCurrentPeriod() external view returns (uint);

    /// @notice Shows if a candidate has been nominated in the current epoch
    function isNominated(address candidate) external view returns (bool);

    /// @notice Returns a list of all nominated candidates in the current epoch
    function getNominees() external view returns (address[] memory);

    /// @notice Hashes a list of candidates (used for identifying and storing ballots)
    function calculateBallotId(address[] calldata candidates) external pure returns (bytes32);

    /// @notice Returns the ballot id that user voted on in the current election
    function getBallotVoted(address user) external view returns (bytes32);

    /// @notice Returns if user has voted in the current election
    function hasVoted(address user) external view returns (bool);

    /// @notice Returns the vote power of user in the current election
    function getVotePower(address user) external view returns (uint);

    /// @notice Returns the number of votes given to a particular ballot
    function getBallotVotes(bytes32 ballotId) external view returns (uint);

    /// @notice Returns the list of candidates that a particular ballot has
    function getBallotCandidates(bytes32 ballotId) external view returns (address[] memory);

    /// @notice Returns whether all ballots in the current election have been counted
    function isElectionEvaluated() external view returns (bool);

    /// @notice Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated
    function getCandidateVotes(address candidate) external view returns (uint);

    /// @notice Returns the winners of the current election. Requires the election to be partially or totally evaluated
    function getElectionWinners() external view returns (address[] memory);

    /// @notice Returns the address of the council NFT token
    function getCouncilToken() external view returns (address);

    /// @notice Returns the current NFT token holders
    function getCouncilMembers() external view returns (address[] memory);
}
