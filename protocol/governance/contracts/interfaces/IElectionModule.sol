//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Epoch} from "../storage/Epoch.sol";
import {ElectionSettings} from "../storage/ElectionSettings.sol";

/// @title Module for electing a council, represented by a set of NFT holders
interface IElectionModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    /// @notice Initializes the module and immediately starts the first epoch
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 epochSeatCount,
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

    /// @notice Adjust settings that will be used on next epoch
    function setNextElectionSettings(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 minEpochDuration,
        uint64 minNominationPeriodDuration,
        uint64 minVotingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) external;

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

    /// @notice Shows the current epoch schedule dates
    function getEpochSchedule() external view returns (Epoch.Data memory epoch);

    /// @notice Shows the settings for the current election
    function getElectionSettings() external view returns (ElectionSettings.Data memory settings);

    /// @notice Returns the index of the current epoch. The first epoch's index is 1
    function getEpochIndex() external view returns (uint);

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
