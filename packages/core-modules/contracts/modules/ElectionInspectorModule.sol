//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IElectionInspectorModule.sol";
import "../submodules/election/ElectionBase.sol";

/// @title Module that simply adds view functions to retrieve additional info from the election module, such as historical election info
contract ElectionInspectorModule is IElectionInspectorModule, ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    // solhint-disable-next-line no-empty-blocks
    function initializeElectionInspectorModule() external {}

    function isElectionInspectorModuleInitialized() external pure returns (bool) {
        return true;
    }

    function getEpochStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).startDate;
    }

    function getEpochEndDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).endDate;
    }

    function getNominationPeriodStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).nominationPeriodStartDate;
    }

    function getVotingPeriodStartDateForIndex(uint epochIndex) external view override returns (uint64) {
        return _getEpochAtIndex(epochIndex).votingPeriodStartDate;
    }

    function wasNominated(address candidate, uint epochIndex) external view override returns (bool) {
        return _getElectionAtIndex(epochIndex).nominees.contains(candidate);
    }

    function getNomineesAtEpoch(uint epochIndex) external view override returns (address[] memory) {
        return _getElectionAtIndex(epochIndex).nominees.values();
    }

    function getBallotVotedAtEpoch(address user, uint epochIndex) public view override returns (bytes32) {
        return _getElectionAtIndex(epochIndex).ballotIdsByAddress[user];
    }

    function hasVotedInEpoch(address user, uint epochIndex) external view override returns (bool) {
        return getBallotVotedAtEpoch(user, epochIndex) != bytes32(0);
    }

    function getBallotVotesInEpoch(bytes32 ballotId, uint epochIndex) external view override returns (uint) {
        return _getBallotInEpoch(ballotId, epochIndex).votes;
    }

    function getBallotCandidatesInEpoch(bytes32 ballotId, uint epochIndex)
        external
        view
        override
        returns (address[] memory)
    {
        return _getBallotInEpoch(ballotId, epochIndex).candidates;
    }

    function getCandidateVotesInEpoch(address candidate, uint epochIndex) external view override returns (uint) {
        return _getElectionAtIndex(epochIndex).candidateVotes[candidate];
    }

    function getElectionWinnersInEpoch(uint epochIndex) external view override returns (address[] memory) {
        return _getElectionAtIndex(epochIndex).winners.values();
    }
}
