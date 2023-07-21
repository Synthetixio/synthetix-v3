//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
        uint8 nextEpochSeatCount,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external virtual override onlyIfNotInitialized {
        OwnableStorage.onlyOwner();

        _initOrUpgradeElectionModule(
            firstCouncil,
            minimumActiveMembers,
            nextEpochSeatCount,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    function _initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint8 nextEpochSeatCount,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        Council.Data storage store = Council.load();

        if (minimumActiveMembers == 0 || minimumActiveMembers > nextEpochSeatCount) {
            revert InvalidMinimumActiveMembers();
        }

        uint64 epochStartDate = block.timestamp.to64();

        ElectionSettings.Data storage settings = store.getCurrentElectionSettings();
        settings.minNominationPeriodDuration = 2 days;
        settings.minVotingPeriodDuration = 2 days;
        settings.minEpochDuration = 7 days;
        settings.expectedEpochDuration = epochEndDate - epochStartDate;
        settings.maxDateAdjustmentTolerance = 7 days;
        settings.nextEpochSeatCount = nextEpochSeatCount;
        settings.minimumActiveMembers = minimumActiveMembers;

        Epoch.Data storage firstEpoch = store.getCurrentElection().epoch;

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
        _setMaxDateAdjustmentTolerance(newMaxDateAdjustmentTolerance);
        emit MaxDateAdjustmentToleranceChanged(newMaxDateAdjustmentTolerance);
    }

    function setNextEpochSeatCount(
        uint8 newSeatCount
    ) external override onlyInPeriod(Council.ElectionPeriod.Administration) {
        OwnableStorage.onlyOwner();
        if (newSeatCount == 0) revert InvalidElectionSettings();

        Council.load().getCurrentElectionSettings().nextEpochSeatCount = newSeatCount;

        emit NextEpochSeatCountChanged(newSeatCount);
    }

    function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external override {
        OwnableStorage.onlyOwner();
        if (newMinimumActiveMembers == 0) revert InvalidMinimumActiveMembers();

        Council.load().getCurrentElectionSettings().minimumActiveMembers = newMinimumActiveMembers;

        emit MinimumActiveMembersChanged(newMinimumActiveMembers);
    }

    function dismissMembers(address[] calldata membersToDismiss) external override {
        OwnableStorage.onlyOwner();

        Council.Data storage store = Council.load();

        uint epochIndex = store.lastElectionId;

        _removeCouncilMembers(membersToDismiss, epochIndex);

        emit CouncilMembersDismissed(membersToDismiss, epochIndex);

        // Don't immediately jump to an election if the council still has enough members
        if (store.getCurrentPeriod() != Council.ElectionPeriod.Administration) return;

        if (
            store.councilMembers.length() >= store.getCurrentElectionSettings().minimumActiveMembers
        ) {
            return;
        }

        _jumpToNominationPeriod();

        emit EmergencyElectionStarted(epochIndex);
    }

    function nominate() public virtual override onlyInPeriod(Council.ElectionPeriod.Nomination) {
        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);

        emit CandidateNominated(msg.sender, Council.load().lastElectionId);

        // TODO: add ballot id to emitted event
    }

    function withdrawNomination()
        external
        override
        onlyInPeriod(Council.ElectionPeriod.Nomination)
    {
        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);

        emit NominationWithdrawn(msg.sender, Council.load().lastElectionId);
    }

    /// TODO: Cross-chain voting;
    /// i.e. you vote on the chain you're LPing on, it sends a message to a mothership deployment to tabulate,
    /// and then it sends a message back at the end of the period to all the chains to transfer NFTs.
    /// @dev ElectionVotes needs to be extended to specify what determines voting power
    ///
    // * if im the mothership -> call recv on self; dop same thig but ccipSend call
    /// * _recvCast func is a majority of  the actual code that was in cast before; is would take user and voting power and tally up based on that info
    // * configure mothership func
    /// * on tally, if not mothership, revert; else do the final tally and distribute NFTs ( in seprate recvEvaluation func and check if mothership self/broadcast msg via CCIP)

    /// * election module provisioned with CREATE2

    //// for next voting period, we'll support v2x voting power through merkle tree; reuse existing code and then disable merkle tree later on when were moved over to v3

    function cast(
        address[] calldata candidates
    ) public virtual override onlyInPeriod(Council.ElectionPeriod.Vote) {
        uint votePower = _getVotePower(msg.sender);

        if (votePower == 0) revert NoVotePower();

        _validateCandidates(candidates);

        bytes32 ballotId;

        uint epochIndex = Council.load().lastElectionId;

        if (hasVoted(msg.sender)) {
            _withdrawCastedVote(msg.sender, epochIndex);
        }

        ballotId = _recordVote(msg.sender, votePower, candidates);

        emit VoteRecorded(msg.sender, ballotId, epochIndex, votePower);
    }

    function withdrawVote() external override onlyInPeriod(Council.ElectionPeriod.Vote) {
        if (!hasVoted(msg.sender)) {
            revert VoteNotCasted();
        }

        _withdrawCastedVote(msg.sender, Council.load().lastElectionId);
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(
        uint numBallots
    ) external override onlyInPeriod(Council.ElectionPeriod.Evaluation) {
        Election.Data storage election = Council.load().getCurrentElection();

        if (election.evaluated) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint currentEpochIndex = Council.load().lastElectionId;

        uint totalBallots = election.ballotIds.length;
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
    function resolve() public virtual override onlyInPeriod(Council.ElectionPeriod.Evaluation) {
        Council.Data storage store = Council.load();
        Election.Data storage election = store.getCurrentElection();

        if (!election.evaluated) revert ElectionNotEvaluated();

        uint newEpochIndex = store.lastElectionId + 1;

        _removeAllCouncilMembers(newEpochIndex);
        _addCouncilMembers(election.winners.values(), newEpochIndex);

        election.resolved = true;

        store.newElection();
        _copySettingsFromPreviousElection();
        _copyScheduleFromPreviousEpoch();

        emit EpochStarted(newEpochIndex);
    }

    function _copySettingsFromPreviousElection() internal {
        Council.Data storage store = Council.load();
        ElectionSettings.Data storage curr = store.getCurrentElectionSettings();
        ElectionSettings.Data storage prev = store.getPreviousElectionSettings();

        curr.nextEpochSeatCount = prev.nextEpochSeatCount;
        curr.minimumActiveMembers = prev.minimumActiveMembers;
        curr.minEpochDuration = prev.minEpochDuration;
        curr.expectedEpochDuration = prev.expectedEpochDuration;
        curr.minNominationPeriodDuration = prev.minNominationPeriodDuration;
        curr.minVotingPeriodDuration = prev.minVotingPeriodDuration;
        curr.maxDateAdjustmentTolerance = prev.maxDateAdjustmentTolerance;
    }

    function getEpochSchedule() external view override returns (Epoch.Data memory epoch) {
        return Council.load().getCurrentElection().epoch;
    }

    function getElectionSettings()
        external
        view
        override
        returns (ElectionSettings.Data memory settings)
    {
        return Council.load().getCurrentElectionSettings();
    }

    function getEpochIndex() external view override returns (uint) {
        return Council.load().lastElectionId;
    }

    function getCurrentPeriod() external view override returns (uint) {
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

    function getVotePower(address user) external view override returns (uint) {
        return _getVotePower(user);
    }

    function getBallotVotes(bytes32 ballotId) external view override returns (uint) {
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

    function getCandidateVotes(address candidate) external view override returns (uint) {
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
