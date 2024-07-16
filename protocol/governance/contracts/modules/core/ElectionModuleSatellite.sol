//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {WormholeCrossChain} from "@synthetixio/core-modules/contracts/storage/WormholeCrossChain.sol";
import {WormholeCrossChainModule} from "./WormholeCrossChainModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {InitializableMixin} from "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {IWormholeRelayer} from "@synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol";
import {ElectionCredentials} from "../../submodules/election/ElectionCredentials.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";
import {Council} from "../../storage/Council.sol";
import {Epoch} from "../../storage/Epoch.sol";

contract ElectionModuleSatellite is
    IElectionModuleSatellite,
    InitializableMixin,
    ElectionCredentials,
    WormholeCrossChainModule
{
    using Ballot for Ballot.Data;
    using Council for Council.Data;
    using CouncilMembers for CouncilMembers.Data;
    using WormholeCrossChain for WormholeCrossChain.Data;
    using Epoch for Epoch.Data;
    using SetUtil for SetUtil.AddressSet;

    uint64 internal constant _MOTHERSHIP_CHAIN_ID = 0;

    /**
     * @dev Utility method for initializing a new Satellite chain
     */
    function initElectionModuleSatellite(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        IWormhole wormholeCore,
        IWormholeRelayer wormholeRelayer,
        address[] calldata councilMembers
    ) external virtual {
        OwnableStorage.onlyOwner();

        Council.Data storage council = Council.load();
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        if (_isInitialized()) {
            return;
        }

        council.initialized = true;

        wh.wormholeCore = wormholeCore;
        wh.wormholeRelayer = wormholeRelayer;

        _setupEpoch(
            epochIndex,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
            councilMembers
        );

        emit InitializedSatellite(
            epochIndex,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
            councilMembers
        );
    }

    function isElectionModuleInitialized() public view override returns (bool) {
        return _isInitialized();
    }

    function _isInitialized() internal view override returns (bool) {
        return Council.load().initialized;
    }

    ///@dev Casts vote on mothership chain
    function cast(
        address[] calldata candidates, //TODO can we change the signature here to just use address candidate
        uint256[] calldata amounts
    ) public payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);
        address sender = ERC2771Context._msgSender();
        bytes memory payload;
        uint256 votingPower;

        /// @dev: load ballot with total votingPower, should have been prepared before,
        /// calling the prepareBallotWithSnapshot method
        uint256 currentEpoch = Council.load().currentElectionId;

        Ballot.Data storage ballot = Ballot.load(currentEpoch, sender, block.chainid);
        votingPower = ballot.votingPower;
        if (votingPower == 0) {
            revert NoVotingPower(sender, currentEpoch);
        }

        payload = abi.encodeWithSelector(
            IElectionModule._recvCast.selector,
            currentEpoch,
            sender,
            votingPower,
            block.chainid,
            candidates,
            amounts
        );

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        uint16[] memory targetChains = new uint16[](1);
        targetChains[0] = wh.getChainIdAt(_MOTHERSHIP_CHAIN_ID);

        broadcast(wh, targetChains, payload, 0);

        emit VoteCastSent(sender, candidates, amounts);
    }

    ///@dev Withdraws a vote that has already been casted by the sender
    function withdrawVote(address[] calldata candidates) public payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        address sender = ERC2771Context._msgSender();

        uint256 currentEpoch = Council.load().currentElectionId;

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        uint16[] memory targetChains = new uint16[](1);
        targetChains[0] = wh.getChainIdAt(_MOTHERSHIP_CHAIN_ID);

        broadcast(
            wh,
            targetChains,
            abi.encodeWithSelector(
                IElectionModule._recvWithdrawVote.selector,
                currentEpoch,
                sender,
                block.chainid,
                candidates
            ),
            0
        );

        emit VoteWithdrawnSent(sender, candidates);
    }

    function _recvDismissMembers(
        address[] calldata membersToDismiss,
        uint256 epochIndex
    ) external override {
        WormholeCrossChain.onlyCrossChain();

        _removeCouncilMembers(membersToDismiss, epochIndex);

        emit CouncilMembersDismissed(membersToDismiss, epochIndex);
    }

    function _recvResolve(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address[] calldata councilMembers
    ) external override {
        WormholeCrossChain.onlyCrossChain();

        _setupEpoch(
            epochIndex,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate,
            councilMembers
        );
    }

    function _recvTweakEpochSchedule(
        uint256 epochIndex,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) external override {
        WormholeCrossChain.onlyCrossChain();

        Epoch.Data storage epoch = Epoch.load(epochIndex);

        epoch.setEpochDates(
            epoch.startDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        emit EpochScheduleTweaked(
            epochIndex,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    function _setupEpoch(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address[] calldata councilMembers
    ) private {
        Council.Data storage council = Council.load();
        uint256 prevEpochIndex = council.currentElectionId;

        council.currentElectionId = epochIndex;

        Epoch.Data storage epoch = Epoch.load(epochIndex);
        epoch.setEpochDates(
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        _removeAllCouncilMembers(prevEpochIndex);
        _addCouncilMembers(councilMembers, epochIndex);

        emit EpochSetup(
            epochIndex,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }
}
