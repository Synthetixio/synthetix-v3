//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IElectionInspectorModule {
    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeElectionInspectorModule() external;

    function isElectionInspectorModuleInitialized() external pure returns (bool);

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    function getEpochStartDateForIndex(uint epochIndex) external view returns (uint64);

    function getEpochEndDateForIndex(uint epochIndex) external view returns (uint64);

    function getNominationPeriodStartDateForIndex(uint epochIndex) external view returns (uint64);

    function getVotingPeriodStartDateForIndex(uint epochIndex) external view returns (uint64);

    function wasNominated(address candidate, uint epochIndex) external view returns (bool);

    function getNomineesAtEpoch(uint epochIndex) external view returns (address[] memory);

    function getBallotVotedAtEpoch(address user, uint epochIndex) external view returns (bytes32);

    function hasVotedInEpoch(address user, uint epochIndex) external view returns (bool);

    function getBallotVotesInEpoch(bytes32 ballotId, uint epochIndex) external view returns (uint);

    function getBallotCandidatesInEpoch(bytes32 ballotId, uint epochIndex) external view returns (address[] memory);

    function getCandidateVotes(address candidate) external view returns (uint);

    function getCandidateVotesInEpoch(address candidate, uint epochIndex) external view returns (uint);

    function getElectionWinners() external view returns (address[] memory);

    function getElectionWinnersInEpoch(uint epochIndex) external view returns (address[] memory);

    function getCouncilMembers() external view returns (address[] memory);

    function calculateBallotId(address[] calldata candidates) external pure returns (bytes32);

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

    function getMinimumActiveMembers() external view returns (uint8);

    function getEpochIndex() external view returns (uint);

    function getEpochStartDate() external view returns (uint64);

    function getEpochEndDate() external view returns (uint64);

    function getNominationPeriodStartDate() external view returns (uint64);

    function getVotingPeriodStartDate() external view returns (uint64);

    function getBallotVotes(bytes32 ballotId) external view returns (uint);

    function getBallotCandidates(bytes32 ballotId) external view returns (address[] memory);

    function getCurrentPeriod() external view returns (uint);

    function getNominees() external view returns (address[] memory);

    function getCouncilToken() external view returns (address);

    function hasVoted(address user) external view returns (bool);

    function isElectionEvaluated() external view returns (bool);

    function getBallotVoted(address user) external view returns (bytes32);

    function isNominated(address candidate) external view returns (bool);
}
