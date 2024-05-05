//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModuleSatellite} from "./IElectionModuleSatellite.sol";
import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {ElectionSettings} from "../storage/ElectionSettings.sol";
import {Epoch} from "../storage/Epoch.sol";
import {Ballot} from "../storage/Ballot.sol";

/// @title Module for electing a council, represented by a set of NFT holders
interface IElectionModule is IElectionModuleSatellite {
    error AlreadyNominated();
    error ElectionAlreadyEvaluated();
    error ElectionNotEvaluated();
    error NotNominated();
    error NoCandidates();
    error DuplicateCandidates(address duplicatedCandidate);
    error TooManyMembers();
    error NotImplemented();

    event ElectionModuleInitialized();
    event EpochStarted(uint256 indexed epochId);
    event EpochScheduleUpdated(uint64 indexed epochId, uint64 startDate, uint64 endDate);
    event EmergencyElectionStarted(uint256 indexed epochId);
    event CandidateNominated(address indexed candidate, uint256 indexed epochId);
    event NominationWithdrawn(address indexed candidate, uint256 indexed epochId);
    event VoteRecorded(
        address indexed voter,
        uint256 indexed chainId,
        uint256 indexed epochId,
        uint256 votingPower,
        address[] candidates
    );

    event VoteWithdrawn(
        address indexed voter,
        uint256 indexed chainId,
        uint256 indexed epochId,
        address[] candidates
    );

    event ElectionBatchEvaluated(
        uint256 indexed epochId,
        uint256 numEvaluatedBallots,
        uint256 totalBallots
    );
    event ElectionEvaluated(uint256 indexed epochId, uint256 ballotCount);

    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    /// @notice Initialises the module and immediately starts the first epoch
    function initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        IWormhole wormholeRouter,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate,
        uint64 administrationPeriodDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) external;

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
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) external;

    /// @notice Allows the owner to remove one or more council members, triggering an election if a threshold is met
    function dismissMembers(address[] calldata members) external payable;

    // ---------------------------------------
    // User write functions
    // ---------------------------------------

    /// @notice Allows anyone to self-nominate during the Nomination period
    function nominate() external;

    /// @notice Self-withdrawal of nominations during the Nomination period
    function withdrawNomination() external;

    /// @dev Internal voting logic, receiving end of CCIP voting
    function _recvCast(
        uint256 epochIndex,
        address voter,
        uint256 votingPower,
        uint256 chainId,
        address[] calldata candidates,
        uint256[] calldata amounts
    ) external;

    function _recvWithdrawVote(
        uint256 epochIndex,
        address voter,
        uint256 chainId,
        address[] calldata candidates
    ) external;

    /// @notice Processes ballots in batches during the Evaluation period (after epochEndDate)
    function evaluate(uint256 numBallots) external;

    /// @notice Shuffles NFTs and resolves an election after it has been evaluated
    function resolve() external payable;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    /// @notice Shows the current epoch schedule dates
    function getEpochSchedule() external view returns (Epoch.Data memory epoch);

    /// @notice Shows the settings for the current election
    function getElectionSettings() external view returns (ElectionSettings.Data memory settings);

    /// @notice Shows the settings for the next election
    function getNextElectionSettings()
        external
        view
        returns (ElectionSettings.Data memory settings);

    /// @notice Returns the index of the current epoch. The first epoch's index is 1
    function getEpochIndex() external view returns (uint256);

    /// @notice Returns the current period type: Administration, Nomination, Voting, Evaluation
    function getCurrentPeriod() external view returns (uint256);

    /// @notice Shows if a candidate has been nominated in the current epoch
    function isNominated(address candidate) external view returns (bool);

    /// @notice Returns a list of all nominated candidates in the current epoch
    function getNominees() external view returns (address[] memory);

    /// @notice Returns if user has voted in the current election
    function hasVoted(address user, uint256 chainId) external view returns (bool);

    /// @notice Returns the vote power of user in the current election
    function getVotePower(
        address user,
        uint256 chainId,
        uint256 electionId
    ) external view returns (uint256);

    /// @notice Returns the list of candidates that a particular ballot has
    function getBallotCandidates(
        address voter,
        uint256 chainId,
        uint256 electionId
    ) external view returns (address[] memory);

    /// @notice Returns whether all ballots in the current election have been counted
    function isElectionEvaluated() external view returns (bool);

    function getBallot(
        address voter,
        uint256 chainId,
        uint256 electionId
    ) external pure returns (Ballot.Data memory);

    /// @notice Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated
    function getCandidateVotes(address candidate) external view returns (uint256);

    /// @notice Returns the winners of the current election. Requires the election to be partially or totally evaluated
    function getElectionWinners() external view returns (address[] memory);

    /// @notice Returns the address of the council NFT token
    function getCouncilToken() external view returns (address);

    /// @notice Returns the current NFT token holders
    function getCouncilMembers() external view returns (address[] memory);
}
