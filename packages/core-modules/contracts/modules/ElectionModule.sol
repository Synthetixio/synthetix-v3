//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../submodules/election/ElectionVotes.sol";
import "../submodules/election/ElectionTally.sol";
import "../interfaces/IElectionModule.sol";

contract ElectionModule is IElectionModule, ElectionSchedule, ElectionVotes, ElectionTally, OwnableMixin {
    using SetUtil for SetUtil.AddressSet;

    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeElectionModule(
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external override onlyOwner onlyIfNotInitialized {
        ElectionStore storage store = _electionStore();

        ElectionSettings storage settings = store.settings;
        settings.minNominationPeriodDuration = 2 days;
        settings.minVotingPeriodDuration = 2 days;
        settings.minEpochDuration = 7 days;
        settings.maxDateAdjustmentTolerance = 7 days;
        settings.nextEpochSeatCount = 3;
        settings.defaultBallotEvaluationBatchSize = 500;

        store.currentEpochIndex = 1;
        _configureFirstEpochSchedule(nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        EpochData storage firstEpoch = store.epochs[1];
        firstEpoch.seatCount = 1;

        // TODO: set owner as only member of the first epoch

        store.initialized = true;
    }

    function isElectionModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    // ---------------------------------------
    // Owner functions
    // ---------------------------------------

    function adjustEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        _adjustEpochSchedule(
            _getCurrentEpoch(),
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            true // ensureChangesAreSmall
        );
    }

    function unsafeAdjustEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        _adjustEpochSchedule(
            _getCurrentEpoch(),
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            false // !ensureChangesAreSmall
        );
    }

    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external override onlyOwner {
        _setMinEpochDurations(newMinNominationPeriodDuration, newMinVotingPeriodDuration, newMinEpochDuration);
    }

    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external override onlyOwner {
        if (newMaxDateAdjustmentTolerance == 0) revert InvalidElectionSettings();

        _electionStore().settings.maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;
    }

    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external override onlyOwner {
        if (newDefaultBallotEvaluationBatchSize == 0) revert InvalidElectionSettings();

        _electionStore().settings.defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;
    }

    function setNextEpochSeatCount(uint8 newSeatCount) external override onlyOwner {
        if (newSeatCount == 0) revert InvalidElectionSettings();

        _electionStore().settings.nextEpochSeatCount = newSeatCount;
    }

    // ---------------------------------------
    // Nomination functions
    // ---------------------------------------

    function nominate() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);
    }

    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);
    }

    // ---------------------------------------
    // Vote functions
    // ---------------------------------------

    function elect(address[] calldata candidates) external override onlyInPeriod(ElectionPeriod.Vote) {
        uint votePower = _getVotePower(msg.sender);
        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        if (_hasVoted(msg.sender)) {
            _withdrawVote(msg.sender, votePower);
        }

        _recordVote(msg.sender, votePower, candidates);
    }

    // ---------------------------------------
    // Election resolution
    // ---------------------------------------

    function evaluate(uint numBallots) external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (isElectionEvaluated()) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        ElectionData storage election = _getCurrentElection();
        if (election.numEvaluatedBallots == election.ballotIds.length) {
            election.evaluated = true;
        }
    }

    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (!isElectionEvaluated()) revert EpochNotEvaluated();

        // TODO: Shuffle NFTs

        _getCurrentElection().resolved = true;

        _configureNextEpochSchedule();

        ElectionStore storage store = _electionStore();
        store.currentEpochIndex = store.currentEpochIndex + 1;
    }

    // ---------------------------------------
    // View functions
    // ---------------------------------------

    // Settings
    // ~~~~~~~~~~~~~~~~~~

    function getMinEpochDurations()
        external
        view
        override
        returns (
            uint64 minNominationPeriodDuration,
            uint64 minVotingPeriodDuration,
            uint64 minEpochDuration
        )
    {
        ElectionSettings storage settings = _electionStore().settings;

        return (settings.minNominationPeriodDuration, settings.minVotingPeriodDuration, settings.minEpochDuration);
    }

    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return _electionStore().settings.maxDateAdjustmentTolerance;
    }

    function getDefaultBallotEvaluationBatchSize() external view override returns (uint) {
        return _electionStore().settings.defaultBallotEvaluationBatchSize;
    }

    function getNextEpochSeatCount() external view override returns (uint8) {
        return _electionStore().settings.nextEpochSeatCount;
    }

    // Epoch and periods
    // ~~~~~~~~~~~~~~~~~~

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

    function getCurrentPeriodType() public view override returns (uint) {
        return uint(_getCurrentPeriodType());
    }

    // Nominations
    // ~~~~~~~~~~~~~~~~~~

    function isNominated(address candidate) external view override returns (bool) {
        return _getCurrentElection().nominees.contains(candidate);
    }

    function getNominees() external view override returns (address[] memory) {
        return _getCurrentElection().nominees.values();
    }

    // Votes
    // ~~~~~~~~~~~~~~~~~~

    function calculateBallotId(address[] calldata candidates) external pure override returns (bytes32) {
        return _calculateBallotId(candidates);
    }

    function getBallotVoted(address voter) external view override returns (bytes32) {
        return _getBallotVoted(voter);
    }

    function hasVoted(address voter) external view override returns (bool) {
        return _hasVoted(voter);
    }

    function getVotePower(address voter) external view override returns (uint) {
        return _getVotePower(voter);
    }

    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
        return _getBallot(ballotId).votes;
    }

    function getBallotCandidates(bytes32 ballotId) external view override returns (address[] memory) {
        return _getBallot(ballotId).candidates;
    }

    // Resolutions
    // ~~~~~~~~~~~~~~~~~~

    function isElectionEvaluated() public view override returns (bool) {
        return _getCurrentElection().evaluated;
    }

    function getCandidateVotes(address candidate) external view override returns (uint) {
        return _getCurrentElection().candidateVotes[candidate];
    }

    function getElectionWinners() external view override returns (address[] memory) {
        return _getCurrentElection().winners.values();
    }
}
