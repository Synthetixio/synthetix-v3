//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {ElectionTally} from "../../submodules/election/ElectionTally.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {Council} from "../../storage/Council.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";
import {Election} from "../../storage/Election.sol";
import {Epoch} from "../../storage/Epoch.sol";
import {ElectionSettings} from "../../storage/ElectionSettings.sol";
import {ElectionModuleSatellite} from "./ElectionModuleSatellite.sol";

contract ElectionModule is IElectionModule, ElectionModuleSatellite, ElectionTally {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using Council for Council.Data;
    using ElectionSettings for ElectionSettings.Data;
    using CouncilMembers for CouncilMembers.Data;
    using CrossChain for CrossChain.Data;
    using SafeCastU256 for uint256;
    using Ballot for Ballot.Data;
    using Epoch for Epoch.Data;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;
    uint8 private constant _MAX_BALLOT_SIZE = 1;

    /**
     * @dev Utility method for initializing a new Satellite chain
     */
    function initElectionModuleSatellite(uint256 chainId) external {
        OwnableStorage.onlyOwner();

        CrossChain.Data storage cc = CrossChain.load();

        cc.validateChainId(chainId);

        CouncilMembers.Data storage councilMembers = CouncilMembers.load();
        Council.Data storage council = Council.load();
        Epoch.Data memory epoch = council.getCurrentEpoch();

        cc.transmit(
            chainId.to64(),
            abi.encodeWithSelector(
                this._recvInitElectionModuleSatellite.selector,
                council.currentElectionId,
                epoch.startDate,
                epoch.nominationPeriodStartDate,
                epoch.votingPeriodStartDate,
                epoch.endDate,
                councilMembers.councilMembers.values()
            ),
            _CROSSCHAIN_GAS_LIMIT
        );
    }

    function initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate,
        uint64 administrationPeriodDuration,
        uint64 nominationPeriodDuration,
        uint64 votingPeriodDuration
    ) external override {
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
        store.getNextElectionSettings().setElectionSettings(
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

        Epoch.Data storage firstEpoch = store.getCurrentEpoch();
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

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);
        Council.Data storage council = Council.load();

        council.adjustEpochSchedule(
            council.getCurrentEpoch(),
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
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);

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

        Council.Data storage council = Council.load();
        Epoch.Data storage epoch = council.getCurrentEpoch();

        CrossChain.Data storage cc = CrossChain.load();
        cc.broadcast(
            cc.getSupportedNetworks(),
            abi.encodeWithSelector(
                this._recvDismissMembers.selector,
                membersToDismiss,
                council.currentElectionId
            ),
            _CROSSCHAIN_GAS_LIMIT
        );

        CouncilMembers.Data storage membersStore = CouncilMembers.load();
        if (epoch.getCurrentPeriod() != Epoch.ElectionPeriod.Administration) return;

        // Don't immediately jump to an election if the council still has enough members
        if (
            membersStore.councilMembers.length() >=
            council.getCurrentElectionSettings().minimumActiveMembers
        ) {
            return;
        }

        council.jumpToNominationPeriod();

        emit EmergencyElectionStarted(council.currentElectionId);
    }

    function nominate() public override {
        Council.onlyInPeriods(Epoch.ElectionPeriod.Nomination, Epoch.ElectionPeriod.Vote);

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;
        address sender = ERC2771Context._msgSender();

        if (nominees.contains(sender)) revert AlreadyNominated();

        nominees.add(sender);

        emit CandidateNominated(sender, Council.load().currentElectionId);
    }

    function withdrawNomination() external override {
        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;
        Council.onlyInPeriod(Epoch.ElectionPeriod.Nomination);

        address sender = ERC2771Context._msgSender();

        if (!nominees.contains(sender)) revert NotNominated();

        nominees.remove(sender);

        emit NominationWithdrawn(sender, Council.load().currentElectionId);
    }

    function _recvCast(
        address voter,
        uint256 votingPower,
        uint256 chainId,
        address[] calldata candidates,
        uint256[] calldata amounts
    ) external override {
        CrossChain.onlyCrossChain();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        if (candidates.length > _MAX_BALLOT_SIZE) {
            revert ParameterError.InvalidParameter("candidates", "too many candidates");
        }

        if (candidates.length != amounts.length) {
            revert ParameterError.InvalidParameter("candidates", "length must match amounts");
        }

        _validateCandidates(candidates);

        Council.Data storage council = Council.load();

        Ballot.Data storage ballot = Ballot.load(council.currentElectionId, voter, chainId);

        ballot.votedCandidates = candidates;
        ballot.amounts = amounts;
        ballot.votingPower = votingPower;

        ballot.validate();

        Election.Data storage election = council.getCurrentElection();
        uint256 currentElectionId = council.currentElectionId;

        bytes32 ballotPtr;
        assembly {
            ballotPtr := ballot.slot
        }

        if (!election.ballotPtrs.contains(ballotPtr)) {
            election.ballotPtrs.add(ballotPtr);
        }

        emit VoteRecorded(voter, chainId, currentElectionId, ballot.votingPower);
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint256 numBallots) external override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Evaluation);

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();

        if (election.evaluated) revert ElectionAlreadyEvaluated();

        _evaluateNextBallotBatch(numBallots);

        uint256 currentEpochIndex = council.currentElectionId;

        uint256 totalBallots = election.ballotPtrs.length();
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
        Council.onlyInPeriod(Epoch.ElectionPeriod.Evaluation);

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();

        if (!election.evaluated) revert ElectionNotEvaluated();

        ElectionSettings.Data storage currentElectionSettings = council
            .getCurrentElectionSettings();
        ElectionSettings.Data storage nextElectionSettings = council.getNextElectionSettings();

        nextElectionSettings.copyMissingFrom(currentElectionSettings);
        Epoch.Data memory nextEpoch = _computeEpochFromSettings(nextElectionSettings);

        council.newElection();

        CrossChain.Data storage cc = CrossChain.load();
        cc.broadcast(
            cc.getSupportedNetworks(),
            abi.encodeWithSelector(
                this._recvResolve.selector,
                council.currentElectionId,
                nextEpoch.startDate,
                nextEpoch.nominationPeriodStartDate,
                nextEpoch.votingPeriodStartDate,
                nextEpoch.endDate,
                election.winners.values()
            ),
            _CROSSCHAIN_GAS_LIMIT
        );

        council.validateEpochSchedule(
            nextEpoch.startDate,
            nextEpoch.nominationPeriodStartDate,
            nextEpoch.votingPeriodStartDate,
            nextEpoch.endDate
        );

        election.resolved = true;

        emit EpochStarted(council.currentElectionId);
    }

    function _computeEpochFromSettings(
        ElectionSettings.Data storage settings
    ) private view returns (Epoch.Data memory epoch) {
        uint64 startDate = SafeCastU256.to64(block.timestamp);
        uint64 endDate = startDate + settings.epochDuration;
        uint64 votingPeriodStartDate = endDate - settings.votingPeriodDuration;
        uint64 nominationPeriodStartDate = votingPeriodStartDate -
            settings.nominationPeriodDuration;

        return
            Epoch.Data({
                startDate: startDate,
                votingPeriodStartDate: votingPeriodStartDate,
                nominationPeriodStartDate: nominationPeriodStartDate,
                endDate: endDate
            });
    }

    function getEpochSchedule() external view override returns (Epoch.Data memory epoch) {
        return Council.load().getCurrentEpoch();
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

    function getEpochIndex() external view override returns (uint256) {
        return Council.load().currentElectionId;
    }

    function getCurrentPeriod() external view override returns (uint256) {
        // solhint-disable-next-line numcast/safe-cast
        return uint256(Council.load().getCurrentEpoch().getCurrentPeriod());
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
    ) external view override returns (uint256) {
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

    function getCandidateVotes(address candidate) external view override returns (uint256) {
        return Council.load().getCurrentElection().candidateVoteTotals[candidate];
    }

    function getElectionWinners() external view override returns (address[] memory) {
        return Council.load().getCurrentElection().winners.values();
    }

    function getCouncilToken() public view override returns (address) {
        return CouncilMembers.load().councilToken;
    }

    function getCouncilMembers() external view override returns (address[] memory) {
        return CouncilMembers.load().councilMembers.values();
    }

    function _validateCandidates(address[] calldata candidates) internal virtual {
        uint256 length = candidates.length;

        if (length == 0) {
            revert NoCandidates();
        }

        SetUtil.AddressSet storage nominees = Council.load().getCurrentElection().nominees;

        for (uint256 i = 0; i < length; i++) {
            address candidate = candidates[i];

            // Reject candidates that are not nominated.
            if (!nominees.contains(candidate)) {
                revert NotNominated();
            }

            // Reject duplicate candidates.
            if (i < length - 1) {
                for (uint256 j = i + 1; j < length; j++) {
                    address otherCandidate = candidates[j];

                    if (candidate == otherCandidate) {
                        revert DuplicateCandidates(candidate);
                    }
                }
            }
        }
    }
}
