//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {IOffchainWormholeModule} from "../interfaces/IOffchainWormholeModule.sol";
import {IWormholeRelayerSend, IWormholeRelayerDelivery} from "../interfaces/external/IWormholeRelayer.sol";
import {IWormholeERC7412Receiver} from "../interfaces/external/IWormholeERC7412Receiver.sol";
import {IWormholeReceiver} from "../interfaces/external/IWormholeReceiver.sol";
import {CrossChainWormhole} from "../storage/CrossChainWormhole.sol";
import {CrossChain} from "../utils/CrossChain.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract OffchainWormholeModule is IWormholeReceiver, IOffchainWormholeModule {
    using SetUtil for SetUtil.UintSet;
    using CrossChainWormhole for CrossChainWormhole.Data;

    function configureWormholeCrossChain(
        IWormholeRelayerSend send,
        IWormholeRelayerDelivery recv,
        IWormholeERC7412Receiver read,
        uint64[] memory supportedNetworks,
        uint16[] memory selectors
    ) external {
        OwnableStorage.onlyOwner();

        if (supportedNetworks.length != selectors.length) {
            revert ParameterError.InvalidParameter(
                "selectors",
                "must match length of supportedNetworks"
            );
        }

        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();
        wcc.crossChainRead = read;
        wcc.sender = send;
        wcc.recv = recv;

        for (uint256 i = 0; i < supportedNetworks.length; i++) {
            wcc.chainIdToSelector[supportedNetworks[i]] = selectors[i];
            wcc.selectorToChainId[selectors[i]] = supportedNetworks[i];
        }
    }

    function readCrossChainWormhole(
        bytes32 /* subscriptionId */,
        uint64[] memory chains,
        bytes memory call,
        uint256 /* gasLimit */
    ) external view returns (bytes[] memory responses) {
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();

        IWormholeERC7412Receiver.CrossChainRequest[]
            memory reqs = new IWormholeERC7412Receiver.CrossChainRequest[](chains.length);

        // TODO: this function simulates getting the latest data reasonably possible by choosing a timestamp just a hardcoded bit in the past. However, we could probably do better.
        uint256 curTime = block.timestamp - 30;

        for (uint256 i = 0; i < chains.length; i++) {
            reqs[i] = IWormholeERC7412Receiver.CrossChainRequest({
                chainSelector: wcc.chainIdToSelector[chains[i]],
                timestamp: curTime,
                target: address(this),
                data: call
            });
        }

        return wcc.crossChainRead.getCrossChainData(reqs, 0);
    }

    function sendWormholeMessage(
        uint64[] memory chainIds,
        bytes memory message,
        uint256 gasLimit
    ) external override {
        if (ERC2771Context._msgSender() != address(this)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();
        wcc.broadcast(chainIds, message, gasLimit);
    }

    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory /* additionalVaas */,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 /* deliveryHash */
    ) external payable {
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();

        if (ERC2771Context._msgSender() != address(wcc.recv)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        // solhint-disable-next-line numcast/safe-cast
        address sourceAddr = address(uint160(uint256(sourceAddress)));
        if (sourceAddr != address(this)) {
            revert AccessError.Unauthorized(sourceAddr);
        }

        if (wcc.selectorToChainId[sourceChain] == 0) {
            revert CrossChain.UnsupportedNetwork(sourceChain);
        }

        (bool success, bytes memory result) = address(this).call(payload);

        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        emit ProcessedWormholeMessage(payload, result);
    }
}
