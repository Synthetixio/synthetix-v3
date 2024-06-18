//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../../interfaces/IElectionModule.sol";
import "../../submodules/election/ElectionSchedule.sol";
import "../../submodules/election/ElectionCredentials.sol";
import "../../submodules/election/ElectionVotes.sol";
import "../../submodules/election/ElectionTally.sol";

contract BaseElectionModule is
    IElectionModule,
    ElectionSchedule,
    ElectionCredentials,
    ElectionVotes,
    ElectionTally,
    InitializableMixin
{
    using SetUtil for SetUtil.AddressSet;
    using Council for Council.Data;
    using SafeCastU256 for uint256;

    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external virtual override onlyIfNotInitialized {
        OwnableStorage.onlyOwner();

        _initOrUpgradeElectionModule(
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    function _initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        Council.Data storage store = Council.load();
        // solhint-disable-next-line numcast/safe-cast
        uint8 seatCount = uint8(firstCouncil.length);
        if (minimumActiveMembers == 0 || minimumActiveMembers > seatCount) {
            revert InvalidMinimumActiveMembers();
        }

        ElectionSettings.Data storage settings = store.nextElectionSettings;
        settings.minNominationPeriodDuration = 2 days;
        settings.minVotingPeriodDuration = 2 days;
        settings.minEpochDuration = 7 days;
        settings.maxDateAdjustmentTolerance = 7 days;
        // solhint-disable-next-line numcast/safe-cast
        settings.nextEpochSeatCount = uint8(firstCouncil.length);
        settings.minimumActiveMembers = minimumActiveMembers;
        settings.defaultBallotEvaluationBatchSize = 500;

        store.newElection();

        Epoch.Data storage firstEpoch = store.getCurrentElection().epoch;
        uint64 epochStartDate = block.timestamp.to64();
        _configureEpochSchedule(
            firstEpoch,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        _addCouncilMembers(firstCouncil, 0);

        store.initialized = true;

        emit ElectionModuleInitialized();
        emit EpochStarted(0);
    }

    function isElectionModuleInitialized() public view override returns (bool) {
        return _isInitialized();
    }

    function _isInitialized() internal view override returns (bool) {
        return Council.load().initialized;
    }

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyInPeriod(Council.ElectionPeriod.Administration) {
        OwnableStorage.onlyOwner();
        _adjustEpochSchedule(
            Council.load().getCurrentElection().epoch,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            true /*ensureChangesAreSmall = true*/
        );

        emit EpochScheduleUpdated(
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    function modifyEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override onlyInPeriod(Council.ElectionPeriod.Administration) {
        OwnableStorage.onlyOwner();
        _adjustEpochSchedule(
            Council.load().getCurrentElection().epoch,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate,
            false /*!ensureChangesAreSmall = false*/
        );

        emit EpochScheduleUpdated(
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    function setMinEpochDurations(
        uint64 newMinNominationPeriodDuration,
        uint64 newMinVotingPeriodDuration,
        uint64 newMinEpochDuration
    ) external override {
        OwnableStorage.onlyOwner();
        _setMinEpochDurations(
            newMinNominationPeriodDuration,
            newMinVotingPeriodDuration,
            newMinEpochDuration
        );

        emit MinimumEpochDurationsChanged(
            newMinNominationPeriodDuration,
            newMinVotingPeriodDuration,
            newMinEpochDuration
        );
    }

    function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external override {
        OwnableStorage.onlyOwner();
        if (newMaxDateAdjustmentTolerance == 0) revert InvalidElectionSettings();

        Council
            .load()
            .nextElectionSettings
            .maxDateAdjustmentTolerance = newMaxDateAdjustmentTolerance;

        emit MaxDateAdjustmentToleranceChanged(newMaxDateAdjustmentTolerance);
    }

    function setDefaultBallotEvaluationBatchSize(
        uint256 newDefaultBallotEvaluationBatchSize
    ) external override {
        OwnableStorage.onlyOwner();
        if (newDefaultBallotEvaluationBatchSize == 0) revert InvalidElectionSettings();

        Council
            .load()
            .nextElectionSettings
            .defaultBallotEvaluationBatchSize = newDefaultBallotEvaluationBatchSize;

        emit DefaultBallotEvaluationBatchSizeChanged(newDefaultBallotEvaluationBatchSize);
    }

    function setNextEpochSeatCount(
        uint8 newSeatCount
    ) external override onlyInPeriod(Council.ElectionPeriod.Administration) {
        OwnableStorage.onlyOwner();
        if (newSeatCount == 0) revert InvalidElectionSettings();

        Council.load().nextElectionSettings.nextEpochSeatCount = newSeatCount;

        emit NextEpochSeatCountChanged(newSeatCount);
    }

    function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external override {
        OwnableStorage.onlyOwner();
        if (newMinimumActiveMembers == 0) revert InvalidMinimumActiveMembers();

        Council.load().nextElectionSettings.minimumActiveMembers = newMinimumActiveMembers;

        emit MinimumActiveMembersChanged(newMinimumActiveMembers);
    }

    function dismissMembers(address[] calldata membersToDismiss) external override {
        OwnableStorage.onlyOwner();

        uint256 epochIndex = Council.load().lastElectionId;

        _removeCouncilMembers(membersToDismiss, epochIndex);

        emit CouncilMembersDismissed(membersToDismiss, epochIndex);

        // Don't immediately jump to an election if the council still has enough members
        if (Council.load().getCurrentPeriod() != Council.ElectionPeriod.Administration) return;
        if (
            Council.load().councilMembers.length() >=
            Council.load().nextElectionSettings.minimumActiveMembers
        ) return;

        _jumpToNominationPeriod();

        emit EmergencyElectionStarted(epochIndex);
    }

    function nominate() public virtual override onlyInPeriod(Council.ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        if (nominees.contains(ERC2771Context._msgSender())) revert AlreadyNominated();

        nominees.add(ERC2771Context._msgSender());

        emit CandidateNominated(ERC2771Context._msgSender(), Council.load().lastElectionId);
    }

    function withdrawNomination()
        external
        override
        onlyInPeriod(Council.ElectionPeriod.Nomination)
    {
        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        if (!nominees.contains(ERC2771Context._msgSender())) revert NotNominated();

        nominees.remove(ERC2771Context._msgSender());

        emit NominationWithdrawn(ERC2771Context._msgSender(), Council.load().lastElectionId);
    }

    /// @dev ElectionVotes needs to be extended to specify what determines voting power
    function cast(
        address[] calldata candidates
    ) public virtual override onlyInPeriod(Council.ElectionPeriod.Vote) {
        uint256 votePower = _getVotePower(ERC2771Context._msgSender());

        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        bytes32 ballotId;

        uint256 epochIndex = Council.load().lastElectionId;

        if (hasVoted(ERC2771Context._msgSender())) {
            _withdrawCastedVote(ERC2771Context._msgSender(), epochIndex);
        }

        ballotId = _recordVote(ERC2771Context._msgSender(), votePower, candidates);

        emit VoteRecorded(ERC2771Context._msgSender(), ballotId, epochIndex, votePower);
    }

    function withdrawVote() external override onlyInPeriod(Council.ElectionPeriod.Vote) {
        if (!hasVoted(ERC2771Context._msgSender())) {
            revert VoteNotCasted();
        }

        _withdrawCastedVote(ERC2771Context._msgSender(), Council.load().lastElectionId);
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(
        uint256 numBallots
    ) external override onlyInPeriod(Council.ElectionPeriod.Evaluation) {
        Election.Data storage election = Council.load().getCurrentElection();

        if (election.evaluated) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint256 currentEpochIndex = Council.load().lastElectionId;

        uint256 totalBallots = election.ballotIds.length;
        if (election.numEvaluatedBallots < totalBallots) {
            emit ElectionBatchEvaluated(
                currentEpochIndex,
                election.numEvaluatedBallots,
                totalBallots
            );
        } else {
            election.evaluated = true;

            emit ElectionEvaluated(currentEpochIndex, totalBallots);
        }
    }

    /// @dev Burns previous NFTs and mints new ones
    function resolve() external override onlyInPeriod(Council.ElectionPeriod.Evaluation) {
        Election.Data storage election = Council.load().getCurrentElection();

        if (!election.evaluated) revert ElectionNotEvaluated();

        uint256 newEpochIndex = Council.load().lastElectionId + 1;

        _removeAllCouncilMembers(newEpochIndex);
        _addCouncilMembers(election.winners.values(), newEpochIndex);

        election.resolved = true;

        Council.load().newElection();
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
        ElectionSettings.Data storage settings = Council.load().nextElectionSettings;

        return (
            settings.minNominationPeriodDuration,
            settings.minVotingPeriodDuration,
            settings.minEpochDuration
        );
    }

    function getMaxDateAdjustmenTolerance() external view override returns (uint64) {
        return Council.load().nextElectionSettings.maxDateAdjustmentTolerance;
    }

    function getDefaultBallotEvaluationBatchSize() external view override returns (uint256) {
        return Council.load().nextElectionSettings.defaultBallotEvaluationBatchSize;
    }

    function getNextEpochSeatCount() external view override returns (uint8) {
        return Council.load().nextElectionSettings.nextEpochSeatCount;
    }

    function getMinimumActiveMembers() external view override returns (uint8) {
        return Council.load().nextElectionSettings.minimumActiveMembers;
    }

    function getEpochIndex() external view override returns (uint256) {
        return Council.load().lastElectionId;
    }

    function getEpochStartDate() external view override returns (uint64) {
        return Council.load().getCurrentElection().epoch.startDate;
    }

    function getEpochEndDate() external view override returns (uint64) {
        return Council.load().getCurrentElection().epoch.endDate;
    }

    function getNominationPeriodStartDate() external view override returns (uint64) {
        return Council.load().getCurrentElection().epoch.nominationPeriodStartDate;
    }

    function getVotingPeriodStartDate() external view override returns (uint64) {
        return Council.load().getCurrentElection().epoch.votingPeriodStartDate;
    }

    function getCurrentPeriod() external view override returns (uint256) {
        // solhint-disable-next-line numcast/safe-cast
        return uint(Council.load().getCurrentPeriod());
    }

    function isNominated(address candidate) external view override returns (bool) {
        return Council.load().getCurrentElection().nominees.contains(candidate);
    }

    function getNominees() external view override returns (address[] memory) {
        return Council.load().getCurrentElection().nominees.values();
    }

    function calculateBallotId(
        address[] calldata candidates
    ) external pure override returns (bytes32) {
        return keccak256(abi.encode(candidates));
    }

    function getBallotVoted(address user) public view override returns (bytes32) {
        return Council.load().getCurrentElection().ballotIdsByAddress[user];
    }

    function hasVoted(address user) public view override returns (bool) {
        return Council.load().getCurrentElection().ballotIdsByAddress[user] != bytes32(0);
    }

    function getVotePower(address user) external view override returns (uint256) {
        return _getVotePower(user);
    }

    function getBallotVotes(bytes32 ballotId) external view override returns (uint256) {
        return Council.load().getCurrentElection().ballotsById[ballotId].votes;
    }

    function getBallotCandidates(
        bytes32 ballotId
    ) external view override returns (address[] memory) {
        return Council.load().getCurrentElection().ballotsById[ballotId].candidates;
    }

    function isElectionEvaluated() public view override returns (bool) {
        return Council.load().getCurrentElection().evaluated;
    }

    function getCandidateVotes(address candidate) external view override returns (uint256) {
        return Council.load().getCurrentElection().candidateVotes[candidate];
    }

    function getElectionWinners() external view override returns (address[] memory) {
        return Council.load().getCurrentElection().winners.values();
    }

    function getCouncilToken() public view override returns (address) {
        return Council.load().councilToken;
    }

    function getCouncilMembers() external view override returns (address[] memory) {
        return Council.load().councilMembers.values();
    }
}
