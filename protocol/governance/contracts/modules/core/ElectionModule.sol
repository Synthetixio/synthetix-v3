//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {WormholeCrossChain} from "@synthetixio/core-modules/contracts/storage/WormholeCrossChain.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "@synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol";
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
    using WormholeCrossChain for WormholeCrossChain.Data;
    using SafeCastU256 for uint256;
    using Ballot for Ballot.Data;
    using Epoch for Epoch.Data;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;
    uint8 private constant _MAX_BALLOT_SIZE = 1;

    event MessageReceived(string indexed message);

    /**
     * @dev Do not allow to initialize using the Satellite's function, this
     *     will be taken care by initOrUpdateElectionSettings.
     */
    function initElectionModuleSatellite() external payable {
        revert NotImplemented();
    }

    function emitCrossChainMessage(string memory message) internal {
        emit MessageReceived(message);
    }

    ///@dev Initializes the election module
    function initOrUpdateElectionSettings(
        address[] memory initialCouncil,
        IWormhole wormholeCore,
        IWormholeRelayer wormholeRelayer,
        uint8 minimumActiveMembers,
        uint64 initialNominationPeriodStartDate, // timestamp
        uint64 administrationPeriodDuration, // days
        uint64 nominationPeriodDuration, // days
        uint64 votingPeriodDuration // days
    ) external override {
        OwnableStorage.onlyOwner();

        if (initialCouncil.length > type(uint8).max) {
            revert TooManyMembers();
        }

        Council.Data storage council = Council.load();

        uint8 epochSeatCount;
        uint64 epochDuration;
        ElectionSettings.Data storage nextElectionSettings;

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        wh.wormholeCore = wormholeCore;
        wh.wormholeRelayer = wormholeRelayer;

        // Convert given days to seconds
        administrationPeriodDuration = administrationPeriodDuration * 1 days;
        nominationPeriodDuration = nominationPeriodDuration * 1 days;
        votingPeriodDuration = votingPeriodDuration * 1 days;

        // solhint-disable-next-line numcast/safe-cast
        epochSeatCount = uint8(initialCouncil.length);

        epochDuration =
            administrationPeriodDuration +
            nominationPeriodDuration +
            votingPeriodDuration;

        nextElectionSettings = council.getNextElectionSettings();

        // Set the expected epoch durations for next council
        nextElectionSettings.setElectionSettings(
            epochSeatCount,
            minimumActiveMembers,
            epochDuration,
            nominationPeriodDuration,
            votingPeriodDuration,
            3 days // maxDateAdjustmentTolerance
        );

        // Initialize first epoch if necessary
        if (!_isInitialized()) {
            _initElectionSettings(
                council,
                nextElectionSettings,
                initialCouncil,
                initialNominationPeriodStartDate
            );
        }
    }

    function _initElectionSettings(
        Council.Data storage council,
        ElectionSettings.Data storage electionSettings,
        address[] memory initialCouncil,
        uint64 nominationPeriodStartDate // timestamp
    ) internal {
        ElectionSettings.Data storage currentSettings = council.getCurrentElectionSettings();
        currentSettings.copyMissingFrom(electionSettings);

        // calculate periods timestamps based on durations
        uint64 epochStartDate = block.timestamp.to64();
        uint64 epochEndDate = epochStartDate + electionSettings.epochDuration;
        uint64 votingPeriodStartDate = epochEndDate - electionSettings.votingPeriodDuration;

        // Allow to not set "nominationPeriodStartDate" and infer it from the durations
        if (nominationPeriodStartDate == 0) {
            nominationPeriodStartDate =
                votingPeriodStartDate -
                electionSettings.nominationPeriodDuration;
        }

        Epoch.Data storage firstEpoch = council.getCurrentEpoch();
        council.configureEpochSchedule(
            firstEpoch,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        _addCouncilMembers(initialCouncil, 0);

        council.initialized = true;

        emit ElectionModuleInitialized();
        emit EpochStarted(0);
    }

    function tweakEpochSchedule(
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate
    ) external payable override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);
        Council.Data storage council = Council.load();

        Epoch.Data storage currentEpoch = council.getCurrentEpoch();
        Epoch.Data memory newEpoch = Epoch.Data(
            currentEpoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );

        council.validateEpochScheduleTweak(currentEpoch, newEpoch);

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        uint16[] memory chains = wh.getSupportedNetworks();
        broadcast(
            wh,
            chains,
            abi.encodeWithSelector(
                this._recvTweakEpochSchedule.selector,
                council.currentElectionId,
                newEpoch.nominationPeriodStartDate,
                newEpoch.votingPeriodStartDate,
                newEpoch.endDate
            ),
            0,
            _CROSSCHAIN_GAS_LIMIT
        );

        emit EpochScheduleUpdated(
            newEpoch.nominationPeriodStartDate,
            newEpoch.votingPeriodStartDate,
            newEpoch.endDate
        );
    }

    function setNextElectionSettings(
        uint8 epochSeatCount,
        uint8 minimumActiveMembers,
        uint64 epochDuration, // days
        uint64 nominationPeriodDuration, // days
        uint64 votingPeriodDuration, // days
        uint64 maxDateAdjustmentTolerance // days
    ) external override {
        OwnableStorage.onlyOwner();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Administration);

        Council.load().getNextElectionSettings().setElectionSettings(
            epochSeatCount,
            minimumActiveMembers,
            epochDuration * 1 days,
            nominationPeriodDuration * 1 days,
            votingPeriodDuration * 1 days,
            maxDateAdjustmentTolerance * 1 days
        );
    }

    function dismissMembers(address[] calldata membersToDismiss) external payable override {
        OwnableStorage.onlyOwner();

        Council.Data storage council = Council.load();
        Epoch.Data storage epoch = council.getCurrentEpoch();
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        uint16[] memory chains = wh.getSupportedNetworks();

        broadcast(
            wh,
            chains,
            abi.encodeWithSelector(
                this._recvDismissMembers.selector,
                membersToDismiss,
                council.currentElectionId
            ),
            0,
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
        uint256 epochIndex,
        address voter,
        uint256 votingPower,
        uint256 chainId,
        address[] calldata candidates,
        uint256[] calldata amounts
    ) external override {
        WormholeCrossChain.onlyCrossChain();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);
        if (candidates.length > _MAX_BALLOT_SIZE) {
            revert ParameterError.InvalidParameter("candidates", "too many candidates");
        }

        if (candidates.length != amounts.length) {
            revert ParameterError.InvalidParameter("candidates", "length must match amounts");
        }

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        uint256 currentElectionId = council.currentElectionId;

        if (epochIndex != currentElectionId) {
            revert ParameterError.InvalidParameter("epochIndex", "invalid epoch index");
        }

        _validateCandidates(candidates);

        Ballot.Data storage ballot = Ballot.load(council.currentElectionId, voter, chainId);

        ballot.votedCandidates = candidates;
        ballot.amounts = amounts;
        ballot.votingPower = votingPower;

        ballot.validate();

        bytes32 ballotPtr;
        assembly {
            ballotPtr := ballot.slot
        }

        if (!election.ballotPtrs.contains(ballotPtr)) {
            election.ballotPtrs.add(ballotPtr);
        }

        emit VoteRecorded(voter, chainId, currentElectionId, ballot.votingPower, candidates);
    }

    function _recvWithdrawVote(
        uint256 epochIndex,
        address voter,
        uint256 chainId,
        address[] calldata candidates
    ) external override {
        WormholeCrossChain.onlyCrossChain();
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        if (candidates.length > _MAX_BALLOT_SIZE) {
            revert ParameterError.InvalidParameter("candidates", "too many candidates");
        }

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        uint256 currentElectionId = council.currentElectionId;

        if (epochIndex != currentElectionId) {
            revert ParameterError.InvalidParameter("epochIndex", "invalid epoch index");
        }

        _validateCandidates(candidates);

        Ballot.Data storage ballot = Ballot.load(council.currentElectionId, voter, chainId);

        ballot.amounts = new uint256[](0);
        ballot.votedCandidates = new address[](0);

        ballot.validate();

        bytes32 ballotPtr;
        assembly {
            ballotPtr := ballot.slot
        }

        if (!election.ballotPtrs.contains(ballotPtr)) {
            election.ballotPtrs.add(ballotPtr);
        }

        emit VoteWithdrawn(voter, chainId, currentElectionId, candidates);
    }

    /// @dev ElectionTally needs to be extended to specify how votes are counted
    function evaluate(uint256 numBallots) external payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Evaluation);

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        Epoch.Data memory epoch = council.getCurrentEpoch();
        ElectionSettings.Data storage electionSettings = ElectionSettings.load(
            council.currentElectionId
        );
        if (election.nominees.values().length < electionSettings.minimumActiveMembers) {
            WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

            uint16[] memory chains = wh.getSupportedNetworks();
            broadcast(
                wh,
                chains,
                abi.encodeWithSelector(
                    this._recvTweakEpochSchedule.selector,
                    council.currentElectionId,
                    epoch.nominationPeriodStartDate,
                    epoch.votingPeriodStartDate,
                    epoch.endDate + electionSettings.votingPeriodDuration
                ),
                0,
                _CROSSCHAIN_GAS_LIMIT
            );
        } else {
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
    }

    /// @dev Burns previous NFTs and mints new ones
    function resolve() public payable virtual override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Evaluation);

        Council.Data storage council = Council.load();
        Election.Data storage election = council.getCurrentElection();
        Epoch.Data memory nextEpoch;

        {
            // to prevent stack to deep error
            if (!election.evaluated) revert ElectionNotEvaluated();

            ElectionSettings.Data storage currentElectionSettings = council
                .getCurrentElectionSettings();
            ElectionSettings.Data storage nextElectionSettings = council.getNextElectionSettings();

            nextElectionSettings.copyMissingFrom(currentElectionSettings);
            nextEpoch = _computeEpochFromSettings(nextElectionSettings);

            council.validateEpochSchedule(
                nextEpoch.startDate,
                nextEpoch.nominationPeriodStartDate,
                nextEpoch.votingPeriodStartDate,
                nextEpoch.endDate
            );

            council.newElection();
        }

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        uint16[] memory chains = wh.getSupportedNetworks();
        broadcast(
            wh,
            chains,
            abi.encodeWithSelector(
                this._recvResolve.selector,
                council.currentElectionId,
                nextEpoch.startDate,
                nextEpoch.nominationPeriodStartDate,
                nextEpoch.votingPeriodStartDate,
                nextEpoch.endDate,
                election.winners.values()
            ),
            0,
            _CROSSCHAIN_GAS_LIMIT
        );

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

    function getBallot(
        address voter,
        uint256 chainId,
        uint256 electionId
    ) external pure override returns (Ballot.Data memory) {
        return Ballot.load(electionId, voter, chainId);
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
