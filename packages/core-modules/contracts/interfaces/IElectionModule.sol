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

    function elect(address[] memory candidates) external;

    function evaluate() external;

    function resolve() external;

    function getEpochStatus() external view returns (uint);

    function getEpochIndex() external view returns (uint);

    function getEpochStartDate() external view returns (uint64);

    function getEpochEndDate() external view returns (uint64);

    function getNominationPeriodStartDate() external view returns (uint64);

    function getVotingPeriodStartDate() external view returns (uint64);

    function isCurrentEpochEvaluated() external view returns (bool);

    function getNextEpochStartDate() external view returns (uint64);

    function getNextEpochEndDate() external view returns (uint64);

    function getNextEpochNominationPeriodStartDate() external view returns (uint64);

    function getNextEpochVotingPeriodStartDate() external view returns (uint64);
}
