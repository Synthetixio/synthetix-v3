//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionModule {
    function initializeElectionModule(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external;

    function adjustEpoch(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external;

    function nominate() external;

    function withdrawNomination() external;

    function elect(address[] calldata candidates) external;

    function evaluate() external;

    function resolve() external;

    function getCurrentPeriod() external view returns (uint);

    function getEpochIndex() external view returns (uint);

    function getEpochStartDate() external view returns (uint64);

    function getEpochEndDate() external view returns (uint64);

    function getNominationPeriodStartDate() external view returns (uint64);

    function getVotingPeriodStartDate() external view returns (uint64);

    function isEpochEvaluated() external view returns (bool);

    function isNominated(address candidate) external view returns (bool);

    function getNominees() external view returns (address[] memory);

    function getVotePower(address voter) external view returns (uint);

    function getBallotVotes(bytes32 ballotId) external view returns (uint);

    function getBallotCandidates(bytes32 ballotId) external view returns (address[] memory);

    function getBallotId(address[] calldata candidates) external pure returns (bytes32);

    function getVote(address voter) external view returns (bytes32);
}
