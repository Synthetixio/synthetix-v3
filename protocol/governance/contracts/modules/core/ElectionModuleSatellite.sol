//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {ElectionCredentials} from "../../submodules/election/ElectionCredentials.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";

contract ElectionModuleSatellite is IElectionModuleSatellite, ElectionCredentials {
    using SetUtil for SetUtil.AddressSet;
    using CrossChain for CrossChain.Data;
    using CouncilMembers for CouncilMembers.Data;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;

    function initCouncilMembers(
        address[] memory initialCouncil,
        uint256 initialEpochIndex
    ) external {
        OwnableStorage.onlyOwner();
        _initCouncilMembers(initialCouncil, initialEpochIndex);
    }

    function _initCouncilMembers(
        address[] memory initialCouncil,
        uint256 initialEpochIndex
    ) internal {
        CouncilMembers.Data storage store = CouncilMembers.load();

        if (store.councilMembers.length() > 0) return;

        _addCouncilMembers(initialCouncil, initialEpochIndex);
    }

    function cast(
        address[] calldata candidates,
        uint256[] calldata amounts
    ) public virtual override {
        CrossChain.Data storage cc = CrossChain.load();

        cc.transmit(
            cc.getChainIdAt(0),
            abi.encodeWithSelector(
                IElectionModule._recvCast.selector,
                msg.sender,
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
