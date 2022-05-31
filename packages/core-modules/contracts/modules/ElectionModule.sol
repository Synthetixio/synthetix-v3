//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IElectionModule.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../submodules/election/ElectionCredentials.sol";
import "../submodules/election/ElectionVotes.sol";
import "../submodules/election/ElectionTally.sol";

contract ElectionModule is
    IElectionModule,
    ElectionSchedule,
    ElectionCredentials,
    ElectionVotes,
    ElectionTally,
    OwnableMixin,
    InitializableMixin
{
    using SetUtil for SetUtil.AddressSet;

    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external virtual override onlyOwner onlyIfNotInitialized {
        _initializeElectionModule(
            councilTokenName,
            councilTokenSymbol,
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    function _initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        ElectionStore storage store = _electionStore();

        uint8 seatCount = uint8(firstCouncil.length);
        if (minimumActiveMembers == 0 || minimumActiveMembers > seatCount) {
            revert InvalidMinimumActiveMembers();
        }

        ElectionSettings storage settings = _electionSettings();
        settings.minNominationPeriodDuration = 2 days;
        settings.minVotingPeriodDuration = 2 days;
        settings.minEpochDuration = 7 days;
        settings.maxDateAdjustmentTolerance = 7 days;
        settings.nextEpochSeatCount = uint8(firstCouncil.length);
        settings.minimumActiveMembers = minimumActiveMembers;
        settings.defaultBallotEvaluationBatchSize = 500;

        _createNewEpoch();

        EpochData storage firstEpoch = _getEpochAtIndex(0);
        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpochSchedule(firstEpoch, epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        _createCouncilToken(councilTokenName, councilTokenSymbol);
        _addCouncilMembers(firstCouncil, 0);

        store.initialized = true;

        emit ElectionModuleInitialized();
        emit EpochStarted(1);
    }

    function isElectionModuleInitialized() public view override returns (bool) {
        return _isInitialized();
    }

    function _isInitialized() internal view override returns (bool) {
        return _electionStore().initialized;
    }

    function upgradeCouncilToken(address newCouncilTokenImplementation) external override onlyOwner onlyIfInitialized {
        CouncilToken(_electionStore().councilToken).upgradeTo(newCouncilTokenImplementation);

        emit CouncilTokenUpgraded(newCouncilTokenImplementation);
    }

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Administration) {
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
    ) external override onlyOwner onlyInPeriod(ElectionPeriod.Administration) {
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

        _electionSettings().maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;

        emit MaxDateAdjustmentToleranceChanged(newMaxDateAdjustmentTolerance);
    }

    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external override onlyOwner {
        if (newDefaultBallotEvaluationBatchSize == 0) revert InvalidElectionSettings();

        _electionSettings().defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;

        emit DefaultBallotEvaluationBatchSizeChanged(newDefaultBallotEvaluationBatchSize);
    }

    function setNextEpochSeatCount(uint8 newSeatCount)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Administration)
    {
        if (newSeatCount == 0) revert InvalidElectionSettings();

        _electionSettings().nextEpochSeatCount = newSeatCount;

        emit NextEpochSeatCountChanged(newSeatCount);
    }

    function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external override onlyOwner {
        if (newMinimumActiveMembers == 0) revert InvalidMinimumActiveMembers();

        _electionSettings().minimumActiveMembers = newMinimumActiveMembers;

        emit MinimumActiveMembersChanged(newMinimumActiveMembers);
    }

    function dismissMembers(address[] calldata membersToDismiss) external override onlyOwner {
        uint epochIndex = _getCurrentEpochIndex();

        _removeCouncilMembers(membersToDismiss, epochIndex);

        emit CouncilMembersDismissed(membersToDismiss, epochIndex);

        // Don't immediately jump to an election if the council still has enough members
        if (_getCurrentPeriod() != ElectionPeriod.Administration) return;
        if (_electionStore().councilMembers.length() >= _electionSettings().minimumActiveMembers) return;

        _jumpToNominationPeriod();

        emit EmergencyElectionStarted(epochIndex);
    }

    function nominate() public virtual override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);

        emit CandidateNominated(msg.sender, _getCurrentEpochIndex());
    }

    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);

        emit NominationWithdrawn(msg.sender, _getCurrentEpochIndex());
    }

    /// @dev ElectionVotes needs to be extended to specify what determines voting power
    function cast(address[] calldata candidates) public virtual override onlyInPeriod(ElectionPeriod.Vote) {
        uint votePower = _getVotePower(msg.sender);

        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        bytes32 ballotId;

        uint epochIndex = _getCurrentEpochIndex();

        if (hasVoted(msg.sender)) {
            _withdrawCastedVote(msg.sender, epochIndex);
        }

        ballotId = _recordVote(msg.sender, votePower, candidates);

        emit VoteRecorded(msg.sender, ballotId, epochIndex, votePower);
    }

    function withdrawVote() external override onlyInPeriod(ElectionPeriod.Vote) {
        if (!hasVoted(msg.sender)) {
            revert VoteNotCasted();
        }

        _withdrawCastedVote(msg.sender, _getCurrentEpochIndex());
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint numBallots) external override onlyInPeriod(ElectionPeriod.Evaluation) {
        ElectionData storage election = _getCurrentElection();

        if (election.evaluated) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint currentEpochIndex = _getCurrentEpochIndex();

        uint totalBallots = election.ballotIds.length;
        if (election.numEvaluatedBallots < totalBallots) {
            emit ElectionBatchEvaluated(currentEpochIndex, election.numEvaluatedBallots, totalBallots);
        } else {
            election.evaluated = true;

            emit ElectionEvaluated(currentEpochIndex, totalBallots);
        }
    }

    /// @dev Burns previous NFTs and mints new ones
    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        ElectionData storage election = _getCurrentElection();

        if (!election.evaluated) revert ElectionNotEvaluated();

        uint newEpochIndex = _getCurrentEpochIndex() + 1;

        _removeAllCouncilMembers(newEpochIndex);
        _addCouncilMembers(election.winners.values(), newEpochIndex);

        election.resolved = true;

        _createNewEpoch();
        _copyScheduleFromPreviousEpoch();

        emit EpochStarted(newEpochIndex);
    }

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
        ElectionSettings storage settings = _electionSettings();

        return (settings.minNominationPeriodDuration, settings.minVotingPeriodDuration, settings.minEpochDuration);
    }

    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return _electionSettings().maxDateAdjustmentTolerance;
    }

    function getDefaultBallotEvaluationBatchSize() external view override returns (uint) {
        return _electionSettings().defaultBallotEvaluationBatchSize;
    }

    function getNextEpochSeatCount() external view override returns (uint8) {
        return _electionSettings().nextEpochSeatCount;
    }

    function getMinimumActiveMembers() external view override returns (uint8) {
        return _electionSettings().minimumActiveMembers;
    }

    function getEpochIndex() external view override returns (uint) {
        return _getCurrentEpochIndex();
    }

    function getEpochStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    function getEpochEndDate() external view override returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    function getNominationPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    function getVotingPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    function getCurrentPeriod() external view override returns (uint) {
        return uint(_getCurrentPeriod());
    }

    function isNominated(address candidate) external view override returns (bool) {
        return _getCurrentElection().nominees.contains(candidate);
    }

    function getNominees() external view override returns (address[] memory) {
        return _getCurrentElection().nominees.values();
    }

    function calculateBallotId(address[] calldata candidates) external pure override returns (bytes32) {
        return _calculateBallotId(candidates);
    }

    function getBallotVoted(address user) public view override returns (bytes32) {
        return _getBallotVoted(user);
    }

    function hasVoted(address user) public view override returns (bool) {
        return _getBallotVoted(user) != bytes32(0);
    }

    function getVotePower(address user) external view override returns (uint) {
        return _getVotePower(user);
    }

    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
        return _getBallot(ballotId).votes;
    }

    function getBallotCandidates(bytes32 ballotId) external view override returns (address[] memory) {
        return _getBallot(ballotId).candidates;
    }

    function isElectionEvaluated() public view override returns (bool) {
        return _getCurrentElection().evaluated;
    }

    function getCandidateVotes(address candidate) external view override returns (uint) {
        return _getCurrentElection().candidateVotes[candidate];
    }

    function getElectionWinners() external view override returns (address[] memory) {
        return _getCurrentElection().winners.values();
    }

    function getCouncilToken() public view override returns (address) {
        return _electionStore().councilToken;
    }

    function getCouncilMembers() external view override returns (address[] memory) {
        return _electionStore().councilMembers.values();
    }
}
