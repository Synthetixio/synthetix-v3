//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../interfaces/IElectionModule.sol";
import "../submodules/election/ElectionSchedule.sol";
import "../submodules/election/ElectionCredentials.sol";
import "../submodules/election/ElectionVotes.sol";
import "../submodules/election/ElectionTally.sol";

/// @title Module for electing a council, represented by a set of NFT holders
contract ElectionModule is
    IElectionModule,
    ElectionSchedule,
    ElectionCredentials,
    ElectionVotes,
    ElectionTally,
    OwnableMixin
{
    using SetUtil for SetUtil.AddressSet;

    /// @notice Initializes the module and immediately starts the first epoch with the owner as the single council member
    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) public override onlyOwner onlyIfNotInitialized {
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

        EpochData storage firstEpoch = _getEpochAtPosition(0);
        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpochSchedule(firstEpoch, epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        _createCouncilToken(councilTokenName, councilTokenSymbol);
        _addCouncilMembers(firstCouncil, 0);

        store.initialized = true;

        emit ElectionModuleInitialized();
        emit EpochStarted(1);
    }

    /// @notice Shows whether the module has been initialized
    function isElectionModuleInitialized() public view override returns (bool) {
        return _isInitialized();
    }

    /// @notice Upgrades the implementation of the existing council NFT token
    function upgradeCouncilToken(address newCouncilTokenImplementation) external override onlyOwner onlyIfInitialized {
        CouncilToken(getCouncilToken()).upgradeTo(newCouncilTokenImplementation);

        emit CouncilTokenUpgraded(newCouncilTokenImplementation);
    }

    /// @notice Adjust the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)
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

    /// @notice Adjusts the current epoch schedule requiring that the current period remains Administration
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

    /// @notice Determines minimum values for epoch schedule adjustments
    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external override onlyOwner {
        _setMinEpochDurations(newMinNominationPeriodDuration, newMinVotingPeriodDuration, newMinEpochDuration);

        emit MinimumEpochDurationsChanged(newMinNominationPeriodDuration, newMinVotingPeriodDuration, newMinEpochDuration);
    }

    /// @notice Determines adjustment size for tweakEpochSchedule
    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external override onlyOwner {
        if (newMaxDateAdjustmentTolerance == 0) revert InvalidElectionSettings();

        _electionSettings().maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;

        emit MaxDateAdjustmentToleranceChanged(newMaxDateAdjustmentTolerance);
    }

    /// @notice Determines batch size when evaluate() is called with numBallots = 0
    function setDefaultBallotEvaluationBatchSize(uint newDefaultBallotEvaluationBatchSize) external override onlyOwner {
        if (newDefaultBallotEvaluationBatchSize == 0) revert InvalidElectionSettings();

        _electionSettings().defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;

        emit DefaultBallotEvaluationBatchSizeChanged(newDefaultBallotEvaluationBatchSize);
    }

    /// @notice Determines the number of council members in the next epoch
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

    /// @notice Allows the owner to remove one or more council members, triggering an election if a threshold is met
    function dismissMembers(address[] calldata membersToDismiss) external override onlyOwner {
        _removeCouncilMembers(membersToDismiss);

        emit CouncilMembersDismissed(membersToDismiss);

        // Don't immediately jump to an election if the council still has enough members
        if (_getCurrentPeriod() != ElectionPeriod.Administration) return;
        if (_electionStore().councilMembers.length() >= _electionSettings().minimumActiveMembers) return;

        _jumpToNominationPeriod();

        emit EmergencyElectionStarted();
    }

    /// @notice Allows anyone to self-nominate during the Nomination period
    function nominate() public virtual override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);

        emit CandidateNominated(msg.sender);
    }

    /// @notice Self-withdrawal of nominations during the Nomination period
    function withdrawNomination() external override onlyInPeriod(ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = _getCurrentElection().nominees;

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);

        emit NominationWithdrawn(msg.sender);
    }

    /// @notice Allows anyone with vote power to vote on nominated candidates during the Voting period
    /// @dev ElectionVotes needs to be extended to specify what determines voting power
    function cast(address[] calldata candidates) external override onlyInPeriod(ElectionPeriod.Vote) {
        uint votePower = _getVotePower(msg.sender);

        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        bytes32 ballotId;

        if (hasVoted(msg.sender)) {
            _withdrawCastedVote(msg.sender);
        }

        ballotId = _recordVote(msg.sender, votePower, candidates);

        emit VoteRecorded(msg.sender, ballotId, votePower);
    }

    /// @notice Allows votes to be withdraw
    function withdrawVote() external {
        if (!hasVoted(msg.sender)) {
            revert VoteNotCasted();
        }

        _withdrawCastedVote(msg.sender);
    }

    /// @notice Processes ballots in batches during the Evaluation period (after epochEndDate)
    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint numBallots) external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (isElectionEvaluated()) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint currentEpochIndex = _getCurrentEpochIndex();
        ElectionData storage election = _getCurrentElection();

        uint totalBallots = election.ballotIds.length;
        if (election.numEvaluatedBallots < totalBallots) {
            emit ElectionBatchEvaluated(currentEpochIndex, election.numEvaluatedBallots, totalBallots);
        } else {
            election.evaluated = true;

            emit ElectionEvaluated(currentEpochIndex, totalBallots);
        }
    }

    /// @notice Shuffles NFTs and resolves an election after it has been evaluated
    /// @dev Burns previous NFTs and mints new ones
    function resolve() external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (!isElectionEvaluated()) revert ElectionNotEvaluated();

        _removeAllCouncilMembers();
        _addCouncilMembers(_getCurrentElection().winners.values(), _getCurrentEpochIndex() + 1);

        _getCurrentElection().resolved = true;

        _createNewEpoch();

        _copyScheduleFromPreviousEpoch();

        emit EpochStarted(_getCurrentEpochIndex());
    }

    /// @notice Exposes minimum durations required when adjusting epoch schedules
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

    /// @notice Exposes maximum size of adjustments when calling tweakEpochSchedule
    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return _electionSettings().maxDateAdjustmentTolerance;
    }

    /// @notice Shows the default batch size when calling evaluate() with numBallots = 0
    function getDefaultBallotEvaluationBatchSize() external view override returns (uint) {
        return _electionSettings().defaultBallotEvaluationBatchSize;
    }

    /// @notice Shows the number of council members that the next epoch will have
    function getNextEpochSeatCount() external view override returns (uint8) {
        return _electionSettings().nextEpochSeatCount;
    }

    /// @notice Returns the minimum active members that the council needs to avoid an emergency election
    function getMinimumActiveMembers() external view override returns (uint8) {
        return _electionSettings().minimumActiveMembers;
    }

    /// @notice Returns the index of the current epoch. The first epoch's index is 1
    function getEpochIndex() external view override returns (uint) {
        return _getCurrentEpochIndex();
    }

    /// @notice Returns the date in which the current epoch started
    function getEpochStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().startDate;
    }

    /// @notice Returns the date in which the current epoch will end
    function getEpochEndDate() external view override returns (uint64) {
        return _getCurrentEpoch().endDate;
    }

    /// @notice Returns the date in which the Nomination period in the current epoch will start
    function getNominationPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().nominationPeriodStartDate;
    }

    /// @notice Returns the date in which the Voting period in the current epoch will start
    function getVotingPeriodStartDate() external view override returns (uint64) {
        return _getCurrentEpoch().votingPeriodStartDate;
    }

    /// @notice Returns the current period type: Administration, Nomination, Voting, Evaluation
    function getCurrentPeriod() external view override returns (uint) {
        return uint(_getCurrentPeriod());
    }

    /// @notice Shows if a candidate has been nominated in the current epoch
    function isNominated(address candidate) external view override returns (bool) {
        return _getCurrentElection().nominees.contains(candidate);
    }

    /// @notice Returns a list of all nominated candidates in the current epoch
    function getNominees() external view override returns (address[] memory) {
        return _getCurrentElection().nominees.values();
    }

    /// @notice Hashes a list of candidates (used for identifying and storing ballots)
    function calculateBallotId(address[] calldata candidates) external pure override returns (bytes32) {
        return _calculateBallotId(candidates);
    }

    /// @notice Returns the ballot id that user voted on in the current election
    function getBallotVoted(address user) public view override returns (bytes32) {
        return _getCurrentElection().ballotIdsByAddress[user];
    }

    /// @notice Returns of user has voted in the current election
    function hasVoted(address user) public view override returns (bool) {
        return getBallotVoted(user) != bytes32(0);
    }

    /// @notice Returns the vote power of user in the current election
    function getVotePower(address user) external view override returns (uint) {
        return _getVotePower(user);
    }

    /// @notice Returns the number of votes given to a particular ballot
    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
        return _getBallot(ballotId).votes;
    }

    /// @notice Returns the list of candidates that a particular ballot has
    function getBallotCandidates(bytes32 ballotId) external view override returns (address[] memory) {
        return _getBallot(ballotId).candidates;
    }

    /// @notice Returns whether all ballots in the current election have been counted
    function isElectionEvaluated() public view override returns (bool) {
        return _getCurrentElection().evaluated;
    }

    /// @notice Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated
    function getCandidateVotes(address candidate) external view override returns (uint) {
        return _getCurrentElection().candidateVotes[candidate];
    }

    /// @notice Returns the winners of the current election. Requires the election to be partially or totally evaluated
    function getElectionWinners() external view override returns (address[] memory) {
        return _getCurrentElection().winners.values();
    }

    /// @notice Returns the address of the council NFT token
    function getCouncilToken() public view override returns (address) {
        return _electionStore().councilToken;
    }

    /// @notice Returns the current NFT token holders
    function getCouncilMembers() external view override returns (address[] memory) {
        return _electionStore().councilMembers.values();
    }
}
