//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module that simply adds view functions to retrieve additional info from the election module, such as historical election info
/// @dev View functions add to contract size, since they bloat the Solidity function dispatcher
interface IElectionInspectorModule {
    // ---------------------------------------
    // View functions
    // ---------------------------------------

    /// @notice Returns the date in which the given epoch started
    function getEpochStartDateForIndex(uint epochIndex) external view returns (uint64);

    /// @notice Returns the date in which the given epoch ended
    function getEpochEndDateForIndex(uint epochIndex) external view returns (uint64);

    /// @notice Returns the date in which the Nomination period in the given epoch started
    function getNominationPeriodStartDateForIndex(uint epochIndex) external view returns (uint64);

    /// @notice Returns the date in which the Voting period in the given epoch started
    function getVotingPeriodStartDateForIndex(uint epochIndex) external view returns (uint64);

    /// @notice Shows if a candidate was nominated in the given epoch
    function wasNominated(address candidate, uint epochIndex) external view returns (bool);

    /// @notice Returns a list of all nominated candidates in the given epoch
    function getNomineesAtEpoch(uint epochIndex) external view returns (address[] memory);

    /// @notice Returns the ballot id that user voted on in the given election
    function getBallotVotedAtEpoch(address user, uint epochIndex) external view returns (bytes32);

    /// @notice Returns if user has voted in the given election
    function hasVotedInEpoch(address user, uint epochIndex) external view returns (bool);

    /// @notice Returns the number of votes given to a particular ballot in a given epoch
    function getBallotVotesInEpoch(bytes32 ballotId, uint epochIndex) external view returns (uint);

    /// @notice Returns the list of candidates that a particular ballot has in a given epoch
    function getBallotCandidatesInEpoch(
        bytes32 ballotId,
        uint epochIndex
    ) external view returns (address[] memory);

    /// @notice Returns the number of votes a candidate received in a given epoch
    function getCandidateVotesInEpoch(
        address candidate,
        uint epochIndex
    ) external view returns (uint);

    /// @notice Returns the winners of the given election
    function getElectionWinnersInEpoch(uint epochIndex) external view returns (address[] memory);
}
