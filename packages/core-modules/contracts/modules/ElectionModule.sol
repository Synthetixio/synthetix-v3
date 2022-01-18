//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../submodules/election/ElectionVotes.sol";
import "../interfaces/IElectionModule.sol";

contract ElectionModule is IElectionModule, ElectionSchedule, ElectionVotes, OwnableMixin {
    using SetUtil for SetUtil.AddressSet;

    function initializeElectionModule(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external override onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.currentEpochIndex != 0) {
            revert InitError.AlreadyInitialized();
        }

        store.currentEpochIndex = 1;

        _configureFirstEpoch(epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    function adjustEpoch(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        EpochData storage epoch = _getCurrentEpoch();

        _configureEpoch(epoch, epoch.startDate, epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    function elect(address[] calldata candidates) external override onlyInPeriod(ElectionPeriod.Vote) {
        _validateCandidates(candidates);

        uint votePower = _votePowerOf(msg.sender);
        if (votePower == 0) {
            revert NoVotePower();
        }

        _recordVote(msg.sender, votePower, candidates);
    }

    function getVotePower(address voter) external view override returns (uint) {
        return _votePowerOf(voter);
    }

    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
        BallotData storage ballot = _getBallot(ballotId);

        if (!_ballotExists(ballot)) {
            revert BallotDoesNotExist();
        }

        return ballot.votes;
    }

    function getBallotCandidates(bytes32 ballotId) external view override returns (address[] memory) {
        BallotData storage ballot = _getBallot(ballotId);

        if (!_ballotExists(ballot)) {
            revert BallotDoesNotExist();
        }

        return ballot.candidates;
    }

    function getBallotId(address[] calldata candidates) external pure override returns (bytes32) {
        return _getBallotId(candidates);
    }

    function getVote(address voter) external view override returns (bytes32) {
        return _getCurrentEpoch().ballotIdFromVoterAddress[voter];
    }

    function nominate() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentEpoch().nominees;

        if (nominees.contains(msg.sender)) {
            revert AlreadyNominated();
        }

        nominees.add(msg.sender);
    }

    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentEpoch().nominees;

        if (!nominees.contains(msg.sender)) {
            revert NotNominated();
        }

        nominees.remove(msg.sender);
    }

    function isNominated(address candidate) external view override returns (bool) {
        return _getCurrentEpoch().nominees.contains(candidate);
    }

    function getNominees() external view override returns (address[] memory) {
        return _getCurrentEpoch().nominees.values();
    }

    function evaluate() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        // TODO

        _getCurrentEpoch().evaluated = true;
    }

    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (!isEpochEvaluated()) {
            revert EpochNotEvaluated();
        }

        // TODO: Shuffle NFTs

        _getCurrentEpoch().resolved = true;

        _configureNextEpoch();

        ElectionStore storage store = _electionStore();
        store.currentEpochIndex = store.currentEpochIndex + 1;
    }

    function getCurrentPeriod() public view override returns (uint) {
        return uint(_getCurrentPeriod());
    }

    function getEpochIndex() public view override returns (uint) {
        return _electionStore().currentEpochIndex;
    }

    function getEpochStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    function getEpochEndDate() public view override returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    function getNominationPeriodStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    function getVotingPeriodStartDate() public view override returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    function isEpochEvaluated() public view override returns (bool) {
        return _getCurrentEpoch().evaluated;
    }
}
