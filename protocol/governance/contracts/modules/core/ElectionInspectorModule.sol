//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IElectionInspectorModule.sol";
import "../../submodules/election/ElectionBase.sol";

contract ElectionInspectorModule is IElectionInspectorModule, ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function getEpochStartDateForIndex(uint256 epochIndex) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.startDate;
    }

    function getEpochEndDateForIndex(uint256 epochIndex) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.endDate;
    }

    function getNominationPeriodStartDateForIndex(
        uint256 epochIndex
    ) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.nominationPeriodStartDate;
    }

    function getVotingPeriodStartDateForIndex(
        uint256 epochIndex
    ) external view override returns (uint64) {
        return Election.load(epochIndex).epoch.votingPeriodStartDate;
    }

    function wasNominated(
        address candidate,
        uint256 epochIndex
    ) external view override returns (bool) {
        return Election.load(epochIndex).nominees.contains(candidate);
    }

    function getNomineesAtEpoch(
        uint256 epochIndex
    ) external view override returns (address[] memory) {
        return Election.load(epochIndex).nominees.values();
    }

    function getBallotVotedAtEpoch(
        address user,
        uint256 epochIndex
    ) public view override returns (bytes32) {
        return Election.load(epochIndex).ballotIdsByAddress[user];
    }

    function hasVotedInEpoch(
        address user,
        uint256 epochIndex
    ) external view override returns (bool) {
        return getBallotVotedAtEpoch(user, epochIndex) != bytes32(0);
    }

    function getBallotVotesInEpoch(
        bytes32 ballotId,
        uint256 epochIndex
    ) external view override returns (uint256) {
        return Election.load(epochIndex).ballotsById[ballotId].votes;
    }

    function getBallotCandidatesInEpoch(
        bytes32 ballotId,
        uint256 epochIndex
    ) external view override returns (address[] memory) {
        return Election.load(epochIndex).ballotsById[ballotId].candidates;
    }

    function getCandidateVotesInEpoch(
        address candidate,
        uint256 epochIndex
    ) external view override returns (uint256) {
        return Election.load(epochIndex).candidateVotes[candidate];
    }

    function getElectionWinnersInEpoch(
        uint256 epochIndex
    ) external view override returns (address[] memory) {
        return Election.load(epochIndex).winners.values();
    }
}
