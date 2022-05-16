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

        EpochData storage firstEpoch = _getEpochAtIndex(0);
        uint64 epochStartDate = uint64(block.timestamp);
        _configureEpochSchedule(firstEpoch, epochStartDate, nominationPeriodStartDate, votingPeriodStartDate, epochEndDate);

        _createCouncilToken(councilTokenName, councilTokenSymbol);
        _addCouncilMembers(firstCouncil);

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
        CouncilToken(_electionStore().councilToken).upgradeTo(newCouncilTokenImplementation);

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

        if (_hasVoted(msg.sender)) {
            _withdrawCastedVote(msg.sender);
        }

        ballotId = _recordVote(msg.sender, votePower, candidates);

        emit VoteRecorded(msg.sender, ballotId, votePower);
    }

    /// @notice Allows votes to be withdraw
    function withdrawVote() external {
        if (!_hasVoted(msg.sender)) {
            revert VoteNotCasted();
        }

        _withdrawCastedVote(msg.sender);
    }

    /// @notice Processes ballots in batches during the Evaluation period (after epochEndDate)
    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint numBallots) external override onlyInPeriod(ElectionPeriod.Evaluation) {
        if (_getCurrentElection().evaluated) revert ElectionAlreadyEvaluated();

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
        if (!_getCurrentElection().evaluated) revert ElectionNotEvaluated();

        _removeAllCouncilMembers();
        _addCouncilMembers(_getCurrentElection().winners.values());

        _getCurrentElection().resolved = true;

        _createNewEpoch();

        _copyScheduleFromPreviousEpoch();

        emit EpochStarted(_getCurrentEpochIndex());
    }

    /// @notice Returns the vote power of user in the current election
    function getVotePower(address user) external view override returns (uint) {
        return _getVotePower(user);
    }
}
