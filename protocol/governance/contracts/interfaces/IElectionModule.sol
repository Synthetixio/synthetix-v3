//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IElectionModuleSatellite} from "./IElectionModuleSatellite.sol";
import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "@synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol";
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

    event VoteWithdrawn(address indexed voter, uint256 indexed chainId, uint256 indexed epochId);

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
    /// @param initialCouncil addresses that will hold the initial council seats; Length cannot be greater than type(uint8).max or equal to 0
    /// @param wormholeCore wormhole contract address on the current chain https://docs.wormhole.com/wormhole/reference/constants#core-contracts
    /// @param wormholeRelayer wormhole relayer contract address on the current chain https://docs.wormhole.com/wormhole/reference/constants#standard-relayer
    /// @param minimumActiveMembers minimum number of active council members required, cannot be greater than initialCouncil length or equal to 0
    /// @param initialNominationPeriodStartDate start date for the first nomination period
    /// @param administrationPeriodDuration duration of the administration period, in days
    /// @param nominationPeriodDuration duration of the nomination period, in days
    /// @param votingPeriodDuration duration of the voting period, in days
    function initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        IWormhole wormholeCore,
        IWormholeRelayer wormholeRelayer,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate,
        uint64 administrationPeriodDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) external;

    // ---------------------------------------
    // Owner write functions
    // ---------------------------------------

    /// @notice Adjusts the current epoch schedule requiring that the current period remains Administration
    /// @dev This function takes timestamps as parameters for the new start dates for the new periods; can only be called during the Administration period
    /// @param newNominationPeriodStartDate new start date for the nomination period
    /// @param newVotingPeriodStartDate new start date for the voting period
    /// @param newEpochEndDate new end date for the epoch
    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external payable;

    /// @notice Adjust settings that will be used on next epoch
    /// @dev can only be called during the Administration period
    /// @param epochSeatCount number of council seats to be elected in the next epoch
    /// @param minimumActiveMembers minimum number of active council members required
    /// @param epochDuration duration of the epoch in days
    /// @param nominationPeriodDuration duration of the nomination period in days
    /// @param votingPeriodDuration duration of the voting period in days
    /// @param maxDateAdjustmentTolerance maximum allowed difference between the new epoch dates and the current epoch dates in days
    function setNextElectionSettings(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) external;

    /// @notice Allows the owner to remove one or more council members, triggering an election if a threshold is met
    /// @param members list of council members to be removed
    function dismissMembers(address[] calldata members) external payable;

    // ---------------------------------------
    // User write functions
    // ---------------------------------------

    /// @notice Allows anyone to self-nominate during the Nomination period
    function nominate() external;

    /// @notice Self-withdrawal of nominations during the Nomination period
    function withdrawNomination() external;

    /// @dev Internal voting logic, receiving end of voting via Wormhole
    function _recvCast(
        uint256 epochIndex,
        address voter,
        uint256 votingPower,
        uint256 chainId,
        address[] calldata candidates,
        uint256[] calldata amounts
    ) external;

    /// @dev Internal voting withdrawl logic, receiving end of withdrawing vote via Wormhole
    function _recvWithdrawVote(uint256 epochIndex, address voter, uint256 chainId) external;

    /// @notice Processes ballots in batches during the Evaluation period (after epochEndDate)
    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint256 numBallots) external payable;

    /// @notice Shuffles NFTs and resolves an election after it has been evaluated
    /// @dev Burns previous NFTs and mints new ones
    function resolve() external payable;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

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

    /// @notice Returns the number of ballots in the current election
    function getBallot(
        address voter,
        uint256 chainId,
        uint256 electionId
    ) external pure returns (Ballot.Data memory);

    /// @notice Returns the number of ballots in the current election
    function getNumOfBallots() external view returns (uint256);

    /// @notice Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated
    function getCandidateVotes(address candidate) external view returns (uint256);

    /// @notice Returns the winners of the current election. Requires the election to be partially or totally evaluated
    function getElectionWinners() external view returns (address[] memory);

    /// @notice Returns the address of the council NFT token
    function getCouncilToken() external view returns (address);

    /// @notice Returns the current NFT token holders
    function getCouncilMembers() external view returns (address[] memory);
}
