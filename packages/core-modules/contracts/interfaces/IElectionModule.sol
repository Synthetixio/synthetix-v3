//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    // ---------------------------------------
    // Owner functions
    // ---------------------------------------

    function initializeElectionModule(
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external;

    function adjustEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

    function unsafeAdjustEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external;

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

    function evaluate() external;

    function resolve() external;

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    // Epoch and periods
    // ~~~~~~~~~~~~~~~~~~

    function getEpochIndex() external view returns (uint);

    function getEpochStartDate() external view returns (uint64);

    function getEpochEndDate() external view returns (uint64);

    function getNominationPeriodStartDate() external view returns (uint64);

    function getVotingPeriodStartDate() external view returns (uint64);

    function getCurrentPeriodType() external view returns (uint);

    function isEpochEvaluated() external view returns (bool);

    // Nominations
    // ~~~~~~~~~~~~~~~~~~

    function isNominated(address candidate) external view returns (bool);

    function getNominees() external view returns (address[] memory);

    // Votes / ballots
    // ~~~~~~~~~~~~~~~~~~

    function calculateBallotId(address[] calldata candidates) external pure returns (bytes32);

    function getBallotVoted(address voter) external view returns (bytes32);

    function hasVoted(address voter) external view returns (bool);

    function getVotePower(address voter) external view returns (uint);

    function getBallotVotes(bytes32 ballotId) external view returns (uint);

    function getBallotCandidates(bytes32 ballotId) external view returns (address[] memory);
}
