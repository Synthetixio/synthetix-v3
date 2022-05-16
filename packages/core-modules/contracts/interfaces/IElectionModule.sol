//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external;

    function isElectionModuleInitialized() external view returns (bool);

    // ---------------------------------------
    // Owner write functions
    // ---------------------------------------

    function upgradeCouncilToken(address newCouncilTokenImplementation) external;

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

    function modifyEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external;

    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external;

    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external;

    function setNextEpochSeatCount(uint8 newSeatCount) external;

    function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external;

    function dismissMembers(address[] calldata members) external;

    // ---------------------------------------
    // User write functions
    // ---------------------------------------

    function nominate() external;

    function withdrawNomination() external;

    function cast(address[] calldata candidates) external;

    function withdrawVote() external;

    function evaluate(uint numBallots) external;

    function resolve() external;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    function getVotePower(address user) external view returns (uint);
}
