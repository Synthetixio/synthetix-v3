//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../submodules/election/ElectionVotes.sol";
import "../submodules/election/ElectionTally.sol";
import "../submodules/election/ElectionCredentials.sol";
import "../interfaces/IElectionModule.sol";

contract ElectionModule is
    IElectionModule,
    ElectionSchedule,
    ElectionVotes,
    ElectionTally,
    ElectionCredentials,
    OwnableMixin
{
    using SetUtil for SetUtil.AddressSet;

    // ---------------------------------------
    // Initialization
    // ---------------------------------------

    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external override onlyOwner onlyIfNotInitialized {
        ElectionStore storage store = _electionStore();

        ElectionSettings storage settings = _getElectionSettings();
        settings.minNominationPeriodDuration = 2 days;
        settings.minVotingPeriodDuration = 2 days;
        settings.minEpochDuration = 7 days;
        settings.maxDateAdjustmentTolerance = 7 days;
        settings.nextEpochSeatCount = 3;
        settings.defaultBallotEvaluationBatchSize = 500;

        store.currentEpochIndex = 1;
        _configureFirstEpochSchedule(nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        _createCouncilToken(councilTokenName, councilTokenSymbol);
        _addCouncilMember(msg.sender);

        store.initialized = true;

        emit ElectionModuleInitialized();
        emit EpochStarted(1);
    }

    function isElectionModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    // ---------------------------------------
    // Owner functions
    // ---------------------------------------

    function upgradeCouncilToken(address newCouncilTokenImplementation) external override onlyOwner {
        CouncilToken(getCouncilToken()).upgradeTo(newCouncilTokenImplementation);

        emit CouncilTokenUpgraded(newCouncilTokenImplementation);
    }

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        _adjustEpochSchedule(
            _getCurrentEpoch(),
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            true /*ensureChangesAreSmall = true*/
        );

        emit EpochScheduleUpdated(newNominationPeriodStartDate, newVotingPeriodStartDate, newEpochEndDate);
    }

    function modifyEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        _adjustEpochSchedule(
            _getCurrentEpoch(),
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            false /*!ensureChangesAreSmall = false*/
        );

        emit EpochScheduleUpdated(newNominationPeriodStartDate, newVotingPeriodStartDate, newEpochEndDate);
    }

    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external override onlyOwner {
        _setMinEpochDurations(newMinNominationPeriodDuration, newMinVotingPeriodDuration, newMinEpochDuration);

        emit MinimumEpochDurationsChanged(newMinNominationPeriodDuration, newMinVotingPeriodDuration, newMinEpochDuration);
    }

    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external override onlyOwner {
        if (newMaxDateAdjustmentTolerance == 0) revert InvalidElectionSettings();

        _getElectionSettings().maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;

        emit MaxDateAdjustmentToleranceChanged(newMaxDateAdjustmentTolerance);
    }

    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external override onlyOwner {
        if (newDefaultBallotEvaluationBatchSize == 0) revert InvalidElectionSettings();

        _getElectionSettings().defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;

        emit DefaultBallotEvaluationBatchSizeChanged(newDefaultBallotEvaluationBatchSize);
    }

    function setNextEpochSeatCount(uint8 newSeatCount) external override onlyOwner onlyInPeriod(ElectionPeriod.Idle) {
        if (newSeatCount == 0) revert InvalidElectionSettings();

        _getElectionSettings().nextEpochSeatCount = newSeatCount;

        emit NextEpochSeatCountChanged(newSeatCount);
    }

    // ---------------------------------------
    // Nomination functions
    // ---------------------------------------

    function nominate() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);

        emit CandidateNominated(msg.sender);
    }

    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);

        emit NominationWithdrawn(msg.sender);
    }

    // ---------------------------------------
    // Vote functions
    // ---------------------------------------

    function elect(address[] calldata candidates) external override onlyInPeriod(ElectionPeriod.Vote) {
        uint votePower = _getVotePower(msg.sender);

        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        bytes32 ballotId;

        if (_hasVoted(msg.sender)) {
            ballotId = _withdrawVote(msg.sender, votePower);

            emit VoteWithdrawn(msg.sender, ballotId, votePower);
        }

        ballotId = _recordVote(msg.sender, votePower, candidates);

        emit VoteRecorded(msg.sender, ballotId, votePower);
    }

    // ---------------------------------------
    // Election resolution
    // ---------------------------------------

    function evaluate(uint numBallots) external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (isElectionEvaluated()) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        ElectionStore storage store = _electionStore();
        ElectionData storage election = _getCurrentElection();

        uint totalBallots = election.ballotIds.length;
        if (election.numEvaluatedBallots < totalBallots) {
            emit ElectionBatchEvaluated(store.currentEpochIndex, election.numEvaluatedBallots, totalBallots);
        } else {
            election.evaluated = true;

            emit ElectionEvaluated(store.currentEpochIndex, totalBallots);
        }
    }

    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (!isElectionEvaluated()) revert EpochNotEvaluated();

        _removeAllCouncilMembers();
        _addCouncilMembers(_getCurrentElection().winners);

        _getCurrentElection().resolved = true;

        _configureNextEpochSchedule();

        ElectionStore storage store = _electionStore();

        uint newEpochIndex = store.currentEpochIndex + 1;
        store.currentEpochIndex = newEpochIndex;

        emit EpochStarted(newEpochIndex);
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
        ElectionSettings storage settings = _getElectionSettings();

        return (settings.minNominationPeriodDuration, settings.minVotingPeriodDuration, settings.minEpochDuration);
    }

    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return _getElectionSettings().maxDateAdjustmentTolerance;
    }

    function getDefaultBallotEvaluationBatchSize() external view override returns (uint) {
        return _getElectionSettings().defaultBallotEvaluationBatchSize;
    }

    function getNextEpochSeatCount() external view override returns (uint8) {
        return _getElectionSettings().nextEpochSeatCount;
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

    // Credentials
    // ~~~~~~~~~~~~~~~~~~

    function getCouncilToken() public view override returns (address) {
        return _electionStore().councilToken;
    }

    function getCouncilMembers() external view override returns (address[] memory) {
        return _electionStore().councilMembers.values();
    }
}
