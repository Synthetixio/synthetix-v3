//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {InitializableMixin} from "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {ElectionTally} from "../../submodules/election/ElectionTally.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {Council} from "../../storage/Council.sol";
import {Election} from "../../storage/Election.sol";
import {Epoch} from "../../storage/Epoch.sol";
import {ElectionSettings} from "../../storage/ElectionSettings.sol";
import {ElectionModuleSatellite} from "./ElectionModuleSatellite.sol";

contract ElectionModule is
    IElectionModule,
    ElectionModuleSatellite,
    ElectionTally,
    InitializableMixin
{
    using SetUtil for SetUtil.AddressSet;
    using Council for Council.Data;
    using ElectionSettings for ElectionSettings.Data;
    using CrossChain for CrossChain.Data;
    using SafeCastU256 for uint256;
    using Ballot for Ballot.Data;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;
    uint8 private constant _MAX_BALLOT_SIZE = 1;

    function initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate,
        uint64 administrationPeriodDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) external override {
        // TODO: initialization should be called only on mothership and broadcasted?
        OwnableStorage.onlyOwner();

        _initOrUpdateElectionSettings(
            initialCouncil,
            minimumActiveMembers,
            initialNominationPeriodStartDate,
            administrationPeriodDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
            3 days
        );
    }

    function _initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate,
        uint64 administrationPeriodDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) internal {
        Council.Data storage store = Council.load();

        if (initialCouncil.length > type(uint8).max) {
            revert TooManyMembers();
        }

        // solhint-disable-next-line numcast/safe-cast
        uint8 epochSeatCount = uint8(initialCouncil.length);

        administrationPeriodDuration = administrationPeriodDuration * 1 days;
        nominationPeriodDuration = nominationPeriodDuration * 1 days;
        votingPeriodDuration = votingPeriodDuration * 1 days;

        uint64 epochDuration = administrationPeriodDuration +
            nominationPeriodDuration +
            votingPeriodDuration;

        // Set the expected epoch durations for next council
        Council.load().getNextElectionSettings().setElectionSettings(
            epochSeatCount,
            minimumActiveMembers,
            epochDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
            maxDateAdjustmentTolerance
        );

        // If the contract is already initialized, don't initialize current epoch
        if (_isInitialized()) {
            return;
        }

        ElectionSettings.Data storage settings = store.getCurrentElectionSettings();
        settings.setElectionSettings(
            epochSeatCount,
            minimumActiveMembers,
            epochDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
            maxDateAdjustmentTolerance
        );

        // calculate periods timestamps based on durations
        uint64 epochStartDate = block.timestamp.to64();
        uint64 epochEndDate = epochStartDate + epochDuration;
        uint64 votingPeriodStartDate = epochEndDate - votingPeriodDuration;

        // Allow to not set "initialNominationPeriodStartDate" and infer it from the durations
        if (initialNominationPeriodStartDate == 0) {
            initialNominationPeriodStartDate = votingPeriodStartDate - nominationPeriodDuration;
        }

        Epoch.Data storage firstEpoch = store.getCurrentElection().epoch;
        store.configureEpochSchedule(
            firstEpoch,
            epochStartDate,
            initialNominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        _addCouncilMembers(initialCouncil, 0);

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
    ) external override {
        // TODO: onlyOnMothership?

        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Administration);
        Council.Data storage council = Council.load();

        council.adjustEpochSchedule(
            council.getCurrentElection().epoch,
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

    function setNextElectionSettings(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration,
        uint64 maxDateAdjustmentTolerance
    ) external override {
        // TODO: onlyOnMothership?

        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Council.ElectionPeriod.Administration);

        Council.load().getNextElectionSettings().setElectionSettings(
            epochSeatCount,
            minimumActiveMembers,
            epochDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
            maxDateAdjustmentTolerance
        );
    }

    function dismissMembers(address[] calldata membersToDismiss) external override {
        OwnableStorage.onlyOwner();

        CrossChain.Data storage cc = CrossChain.load();
        cc.broadcast(
            cc.getSupportedNetworks(),
            abi.encodeWithSelector(
                IElectionModuleSatellite._recvDismissMembers.selector,
                membersToDismiss
            ),
            _CROSSCHAIN_GAS_LIMIT
        );

        Council.Data storage store = Council.load();
        if (store.getCurrentPeriod() != Council.ElectionPeriod.Administration) return;

        // Don't immediately jump to an election if the council still has enough members
        if (
            store.councilMembers.length() >= store.getCurrentElectionSettings().minimumActiveMembers
        ) {
            return;
        }

        store.jumpToNominationPeriod();

        emit EmergencyElectionStarted(store.currentElectionId);
    }

    function nominate() public virtual override {
        // TODO: onlyOnMothership?

        Council.onlyInPeriods(Council.ElectionPeriod.Nomination, Council.ElectionPeriod.Vote);

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        if (nominees.contains(msg.sender)) revert AlreadyNominated();

        nominees.add(msg.sender);

        emit CandidateNominated(msg.sender, Council.load().currentElectionId);
    }

    function withdrawNomination() external override {
        // TODO: onlyOnMothership?

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;
        Council.onlyInPeriod(Council.ElectionPeriod.Nomination);

        if (!nominees.contains(msg.sender)) revert NotNominated();

        nominees.remove(msg.sender);

        emit NominationWithdrawn(msg.sender, Council.load().currentElectionId);
    }

    function _recvCast(
        address voter,
        uint256 chainId,
        address[] calldata candidates,
        uint256[] calldata amounts
    ) external override {
        CrossChain.onlyOnChainAt(0);
        CrossChain.onlyCrossChain();
        Council.onlyInPeriod(Council.ElectionPeriod.Vote);

        if (candidates.length > _MAX_BALLOT_SIZE) {
            revert ParameterError.InvalidParameter("candidates", "too many candidates");
        }

        if (candidates.length != amounts.length) {
            revert ParameterError.InvalidParameter("candidates", "length must match amounts");
        }

        _validateCandidates(candidates);

        Ballot.Data storage ballot = Ballot.load(
            Council.load().currentElectionId,
            msg.sender,
            block.chainid
        );

        uint256 totalAmounts = 0;
        for (uint i = 0; i < amounts.length; i++) {
            totalAmounts += amounts[i];
        }

        if (totalAmounts == 0 || ballot.votingPower != totalAmounts) {
            revert ParameterError.InvalidParameter(
                "amounts",
                "must be nonzero and sum to ballot voting power"
            );
        }

        ballot.votedCandidates = candidates;
        ballot.amounts = amounts;

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        uint256 currentElectionId = council.currentElectionId;

        Ballot.Data storage storedBallot = Ballot.load(currentElectionId, voter, chainId);

        storedBallot.copy(ballot);
        storedBallot.validate();

        bytes32 ballotPtr;
        assembly {
            ballotPtr := storedBallot.slot
        }

        election.ballotPtrs.push(ballotPtr);

        emit VoteRecorded(voter, chainId, currentElectionId, ballot.votingPower);
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint numBallots) external override {
        CrossChain.onlyOnChainAt(0);
        Council.onlyInPeriod(Council.ElectionPeriod.Evaluation);

        Election.Data storage election = Council.load().getCurrentElection();

        if (election.evaluated) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint currentEpochIndex = Council.load().currentElectionId;

        uint totalBallots = election.ballotPtrs.length;
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
    function resolve() public virtual override {
        CrossChain.onlyOnChainAt(0);
        Council.onlyInPeriod(Council.ElectionPeriod.Evaluation);

        Council.Data storage store = Council.load();
        Election.Data storage election = store.getCurrentElection();

        if (!election.evaluated) revert ElectionNotEvaluated();

        uint newEpochIndex = store.currentElectionId + 1;

        CrossChain.Data storage cc = CrossChain.load();
        cc.broadcast(
            cc.getSupportedNetworks(),
            abi.encodeWithSelector(
                this._recvResolve.selector,
                election.winners.values(),
                newEpochIndex
            ),
            _CROSSCHAIN_GAS_LIMIT
        );
    }

    function _recvResolve(address[] calldata winners, uint256 newEpochIndex) external {
        CrossChain.onlyOnChainAt(0);
        CrossChain.onlyCrossChain();

        Council.Data storage store = Council.load();
        Election.Data storage election = store.getCurrentElection();

        _removeAllCouncilMembers(newEpochIndex);
        _addCouncilMembers(winners, newEpochIndex);

        election.resolved = true;
        store.newElection();

        emit EpochStarted(newEpochIndex);
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

    function getNextElectionSettings()
        external
        view
        override
        returns (ElectionSettings.Data memory settings)
    {
        return Council.load().getNextElectionSettings();
    }

    function getEpochIndex() external view override returns (uint) {
        return Council.load().currentElectionId;
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

    function hasVoted(address user, uint256 chainId) public view override returns (bool) {
        Council.Data storage council = Council.load();
        Ballot.Data storage ballot = Ballot.load(council.currentElectionId, user, chainId);
        return ballot.votingPower > 0 && ballot.votedCandidates.length > 0;
    }

    function getVotePower(
        address user,
        uint256 chainId,
        uint256 electionId
    ) external view override returns (uint) {
        Ballot.Data storage ballot = Ballot.load(electionId, user, chainId);
        return ballot.votingPower;
    }

    function getBallotCandidates(
        address voter,
        uint256 chainId,
        uint256 electionId
    ) external view override returns (address[] memory) {
        return Ballot.load(electionId, voter, chainId).votedCandidates;
    }

    function isElectionEvaluated() public view override returns (bool) {
        return Council.load().getCurrentElection().evaluated;
    }

    function getCandidateVotes(address candidate) external view override returns (uint) {
        return Council.load().getCurrentElection().candidateVoteTotals[candidate];
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

    function _validateCandidates(address[] calldata candidates) internal virtual {
        uint length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        for (uint i = 0; i < length; i++) {
            address candidate = candidates[i];

            // Reject candidates that are not nominated.
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Reject duplicate candidates.
            if (i < length - 1) {
                for (uint j = i + 1; j < length; j++) {
                    address otherCandidate = candidates[j];

                    if (candidate == otherCandidate) {
                        revert DuplicateCandidates(candidate);
                    }
                }
            }
        }
    }
}
