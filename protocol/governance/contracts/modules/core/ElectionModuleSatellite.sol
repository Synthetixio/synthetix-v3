//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";
import {ElectionCredentials} from "../../submodules/election/ElectionCredentials.sol";
import {Council} from "../../storage/Council.sol";

contract ElectionModuleSatellite is IElectionModuleSatellite, ElectionCredentials {
    using CrossChain for CrossChain.Data;
    using Council for Council.Data;

    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;

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

    function _recvDismissMembers(address[] calldata membersToDismiss) external {
        CrossChain.onlyCrossChain();

        Council.Data storage store = Council.load();

        uint electionId = store.currentElectionId;

        _removeCouncilMembers(membersToDismiss, electionId);

        emit CouncilMembersDismissed(membersToDismiss, electionId);
    }

    function _recvResolve(address[] calldata winners) external {
        // TODO: distribute nfts to winners
    }
}
