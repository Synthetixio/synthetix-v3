//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "@synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol";
import {ElectionSettings} from "../storage/ElectionSettings.sol";
import {Epoch} from "../storage/Epoch.sol";

/// @title Election module council with minimal logic to be deployed on Satellite chains
interface IElectionModuleSatellite {
    error NoVotingPower(address sender, uint256 currentEpoch);

    event CouncilMembersDismissed(address[] dismissedMembers, uint256 epochId);

    event InitializedSatellite(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address[] councilMembers
    );

    event EpochSetup(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    );

    event EpochScheduleTweaked(
        uint256 epochIndex,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    );

    event VoteCastSent(address sender, address[] candidates, uint256[] amounts);

    event VoteWithdrawnSent(address sender);

    /// @notice Initialize the election module with the given council members and epoch schedule
    /// @dev Utility method for initializing a new Satellite chain; can only be called once
    /// @param epochIndex the index of the epoch
    /// @param epochStartDate the start date of the epoch (timestamp)
    /// @param nominationPeriodStartDate the start date of the nomination period (timestamp)
    /// @param votingPeriodStartDate the start date of the voting period (timestamp)
    /// @param epochEndDate the end date of the epoch (timestamp)
    /// @param wormholeCore wormhole contract address on the current chain https://docs.wormhole.com/wormhole/reference/constants#core-contracts
    /// @param wormholeRelayer wormhole relayer contract address on the current chain https://docs.wormhole.com/wormhole/reference/constants#standard-relayer
    /// @param councilMembers the initial council members
    function initElectionModuleSatellite(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        IWormhole wormholeCore,
        IWormholeRelayer wormholeRelayer,
        address[] calldata councilMembers
    ) external;

    /// @notice Shows whether the module has been initialized
    function isElectionModuleInitialized() external view returns (bool);

    /// @notice Allows anyone with vote power to vote on nominated candidates during the Voting period
    /// @dev caller must use all of their voting power in one go i.e. no partial votes; casts from satellite get broadcast to mothership chain
    /// @param candidates the candidates to vote for
    /// @param amounts the amount of votes for each candidate
    function cast(address[] calldata candidates, uint256[] calldata amounts) external payable;

    /// @notice Allows to withdraw a casted vote on the current network
    function withdrawVote() external payable;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    /// @notice Returns the current period type: Administration, Nomination, Voting, Evaluation
    function getCurrentPeriod() external view returns (uint256);

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

    /// @dev Burn the council tokens from the given members; receiving end of members dismissal via Wormhole
    function _recvDismissMembers(address[] calldata membersToDismiss, uint256 epochIndex) external;

    /// @dev Tweak the epoch dates to the given ones, without validation because we assume that it was started from mothership
    function _recvTweakEpochSchedule(
        uint256 epochIndex,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external;

    /// @dev Burn current epoch council tokens and assign new ones, setup epoch dates. Receiving end of epoch resolution via Wormhole.
    function _recvResolve(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address[] calldata councilMembers
    ) external;
}
