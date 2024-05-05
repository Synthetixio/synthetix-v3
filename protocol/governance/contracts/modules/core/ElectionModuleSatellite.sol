//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {InitializableMixin} from "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {IWormhole} from "@synthetixio/core-modules/contracts/interfaces/IWormhole.sol";
import {ElectionCredentials} from "../../submodules/election/ElectionCredentials.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";
import {Council} from "../../storage/Council.sol";
import {Epoch} from "../../storage/Epoch.sol";

contract ElectionModuleSatellite is
    IElectionModuleSatellite,
    InitializableMixin,
    ElectionCredentials
{
    using Ballot for Ballot.Data;
    using Council for Council.Data;
    using CouncilMembers for CouncilMembers.Data;
    using CrossChain for CrossChain.Data;
    using Epoch for Epoch.Data;
    using SetUtil for SetUtil.AddressSet;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;

    /**
     * @dev Utility method for initializing a new Satellite chain
     */
    function initElectionModuleSatellite(
        uint256 epochIndex,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        IWormhole wormholeRouter, // just here because interface demands it
        address[] calldata councilMembers
    ) external virtual {
        OwnableStorage.onlyOwner();

        Council.Data storage council = Council.load();

        if (_isInitialized()) {
            return;
        }

        council.initialized = true;

        _setupEpoch(
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

    function cast(
        address[] calldata candidates,
        uint256[] calldata amounts
    ) public payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        address sender = ERC2771Context._msgSender();

        /// @dev: load ballot with total votingPower, should have been prepared before,
        /// calling the prepareBallotWithSnapshot method
        uint256 currentEpoch = Council.load().currentElectionId;
        Ballot.Data storage ballot = Ballot.load(currentEpoch, sender, block.chainid);

        if (ballot.votingPower == 0) {
            revert NoVotingPower(sender, currentEpoch);
        }

        CrossChain.Data storage cc = CrossChain.load();
        cc.transmit(
            cc.getChainIdAt(0),
            abi.encodeWithSelector(
                IElectionModule._recvCast.selector,
                currentEpoch,
                sender,
                ballot.votingPower,
                block.chainid,
                candidates,
                amounts
            ),
            _CROSSCHAIN_GAS_LIMIT
        );
    }

    function withdrawVote(address[] calldata candidates) public payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        address sender = ERC2771Context._msgSender();

        uint256 currentEpoch = Council.load().currentElectionId;

        CrossChain.Data storage cc = CrossChain.load();
        cc.transmit(
            cc.getChainIdAt(0),
            abi.encodeWithSelector(
                IElectionModule._recvWithdrawVote.selector,
                currentEpoch,
                sender,
                block.chainid,
                candidates
            ),
            _CROSSCHAIN_GAS_LIMIT
        );
    }

    function _recvDismissMembers(
        address[] calldata membersToDismiss,
        uint256 epochIndex
    ) external override {
        CrossChain.onlyCrossChain();

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
        CrossChain.onlyCrossChain();

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
        CrossChain.onlyCrossChain();

        Epoch.Data storage epoch = Epoch.load(epochIndex);

        epoch.setEpochDates(
            epoch.startDate,
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
    }
}
