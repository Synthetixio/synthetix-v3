//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {ElectionCredentials} from "../../submodules/election/ElectionCredentials.sol";
import {Ballot} from "../../storage/Ballot.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";
import {Council} from "../../storage/Council.sol";
import {Epoch} from "../../storage/Epoch.sol";

contract ElectionModuleSatellite is IElectionModuleSatellite, ElectionCredentials {
    using Ballot for Ballot.Data;
    using Council for Council.Data;
    using CouncilMembers for CouncilMembers.Data;
    using CrossChain for CrossChain.Data;
    using Epoch for Epoch.Data;
    using SetUtil for SetUtil.AddressSet;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;

    /**
     * @dev When using ElectionModuleSatellite on the mothership, make sure to override
     * this method to be not callable, and add your custom initialization logic.
     */
    function initElectionModule(
        uint256 initialEpochIndex,
        address[] memory initialCouncil
    ) external virtual {
        OwnableStorage.onlyOwner();
        CouncilMembers.Data storage store = CouncilMembers.load();

        if (store.councilMembers.length() > 0) return;

        _addCouncilMembers(initialCouncil, initialEpochIndex);
    }

    function cast(
        address[] calldata candidates,
        uint256[] calldata amounts
    ) public payable override {
        Council.onlyInPeriod(Epoch.ElectionPeriod.Vote);

        address sender = ERC2771Context._msgSender();

        /// @dev: load ballot with total votingPower, should have before been prepared
        /// calling the prepareBallotWithSnapshot method
        uint256 currentEpoch = Council.load().currentElectionId;
        Ballot.Data storage ballot = Ballot.load(currentEpoch, sender, block.chainid);

        CrossChain.Data storage cc = CrossChain.load();
        cc.transmit(
            cc.getChainIdAt(0),
            abi.encodeWithSelector(
                IElectionModule._recvCast.selector,
                sender,
                ballot.votingPower,
                block.chainid,
                candidates,
                amounts
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
        address[] calldata winners,
        uint256 prevEpochIndex,
        uint256 newEpochIndex
    ) external override {
        CrossChain.onlyCrossChain();

        _removeAllCouncilMembers(prevEpochIndex);
        _addCouncilMembers(winners, newEpochIndex);
    }
}
