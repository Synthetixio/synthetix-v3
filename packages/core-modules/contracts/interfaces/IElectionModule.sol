//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external;

    function isElectionModuleInitialized() external view returns (bool);

    // ---------------------------------------
    // Owner functions
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

    // ---------------------------------------
    // Nomination functions
    // ---------------------------------------

    function nominate() external;

    function withdrawNomination() external;

    // ---------------------------------------
    // Vote functions
    // ---------------------------------------

    function elect(address[] calldata candidates) external;

    // ---------------------------------------
    // Election resolution
    // ---------------------------------------

    function evaluate(uint numBallots) external;

    function resolve() external;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    // Settings
    // ~~~~~~~~~~~~~~~~~~

    function getMinEpochDurations()
        external
        view
        returns (
            uint64 minNominationPeriodDuration,
            uint64 minVotingPeriodDuration,
            uint64 minEpochDuration
        );

    function getMaxDateAdjustmenTolerance() external view returns (uint64);

    function getDefaultBallotEvaluationBatchSize() external view returns (uint);

    function getNextEpochSeatCount() external view returns (uint8);

    // Epoch and periods
    // ~~~~~~~~~~~~~~~~~~

    function getEpochIndex() external view returns (uint);

    function getEpochStartDate() external view returns (uint64);

    function getEpochEndDate() external view returns (uint64);

    function getNominationPeriodStartDate() external view returns (uint64);

    function getVotingPeriodStartDate() external view returns (uint64);

    function getCurrentPeriodType() external view returns (uint);

    // Nominations
    // ~~~~~~~~~~~~~~~~~~

    function isNominated(address candidate) external view returns (bool);

    function getNominees() external view returns (address[] memory);

    // Votes
    // ~~~~~~~~~~~~~~~~~~

    function calculateBallotId(address[] calldata candidates) external pure returns (bytes32);

    function getBallotVoted(address voter) external view returns (bytes32);

    function hasVoted(address voter) external view returns (bool);

    function getVotePower(address voter) external view returns (uint);

    function getBallotVotes(bytes32 ballotId) external view returns (uint);

    function getBallotCandidates(bytes32 ballotId) external view returns (address[] memory);

    // Resolutions
    // ~~~~~~~~~~~~~~~~~~

    function isElectionEvaluated() external view returns (bool);

    function getCandidateVotes(address candidate) external view returns (uint);

    function getElectionWinners() external view returns (address[] memory);

    // Credentials
    // ~~~~~~~~~~~~~~~~~~

    function getCouncilToken() external view returns (address);

    function getCouncilMembers() external view returns (address[] memory);
}
