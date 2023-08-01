//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IElectionInspectorModule.sol";
import "../../submodules/election/ElectionBase.sol";

contract ElectionInspectorModule is IElectionInspectorModule, ElectionBase {
    using SetUtil for SetUtil.AddressSet;
    using Ballot for Ballot.Data;

    function getEpochStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.startDate;
    }

    function getEpochEndDateForIndex(uint epochIndex) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.endDate;
    }

    function getNominationPeriodStartDateForIndex(
        uint epochIndex
    ) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.nominationPeriodStartDate;
    }

    function getVotingPeriodStartDateForIndex(
        uint epochIndex
    ) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.votingPeriodStartDate;
    }

    function wasNominated(
        address candidate,
        uint epochIndex
    ) external view override returns (bool) {
        return Election.load(epochIndex).nominees.contains(candidate);
    }

    function getNomineesAtEpoch(uint epochIndex) external view override returns (address[] memory) {
        return Election.load(epochIndex).nominees.values();
    }

    function hasVotedInEpoch(
        address user,
        uint precinct,
        uint epochIndex
    ) external view override returns (bool) {
        return Ballot.load(epochIndex, user, precinct).hasVoted();
    }

    function getCandidateVotesInEpoch(
        address candidate,
        uint epochIndex
    ) external view override returns (uint) {
        return Election.load(epochIndex).candidateVoteTotals[candidate];
    }

    function getElectionWinnersInEpoch(
        uint epochIndex
    ) external view override returns (address[] memory) {
        return Election.load(epochIndex).winners.values();
    }
}
