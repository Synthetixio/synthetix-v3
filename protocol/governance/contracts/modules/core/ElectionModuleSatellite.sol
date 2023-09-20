//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {CrossChain} from "@synthetixio/core-modules/contracts/storage/CrossChain.sol";
import {IElectionModule} from "../../interfaces/IElectionModule.sol";
import {IElectionModuleSatellite} from "../../interfaces/IElectionModuleSatellite.sol";

contract ElectionModuleSatellite is IElectionModuleSatellite {
    using CrossChain for CrossChain.Data;

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
}
