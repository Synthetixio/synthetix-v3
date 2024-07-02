//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "@synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol";

/// @title Election module council with minimal logic to be deployed on Satellite chains
interface IElectionModuleSatellite {
    error NoVotingPower(address sender, uint256 currentEpoch);

    event CouncilMembersDismissed(address[] dismissedMembers, uint256 epochId);

    /// @dev Initialize first epoch of the current election module. Can only be called once.
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
    function cast(address[] calldata candidates, uint256[] calldata amounts) external payable;

    /// @notice Allows to withdraw a casted vote on the current network.
    function withdrawVote(address[] calldata candidates) external payable;

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
