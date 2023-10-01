//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IOffchainWormholeModule.sol";
import "../../interfaces/external/IWormholeReceiver.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChainWormhole.sol";
import "../../utils/CrossChain.sol";

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

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

        for (uint i = 0; i < supportedNetworks.length; i++) {
            wcc.chainIdToSelector[supportedNetworks[i]] = selectors[i];
            wcc.selectorToChainId[selectors[i]] = supportedNetworks[i];
        }
    }

    function readCrossChainWormhole(
        bytes32 /* subscriptionId */,
        uint64[] memory chains,
        bytes memory call,
        uint256 /* gasLimit */
    ) external returns (bytes[] memory responses) {
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();

        IWormholeERC7412Receiver.CrossChainRequest[]
            memory reqs = new IWormholeERC7412Receiver.CrossChainRequest[](chains.length);

        // TODO: this function simulates getting the latest data reasonably possible by choosing a timestamp just a hardcoded bit in the past. However, we could probably do better.
        uint256 curTime = block.timestamp - 30;

        for (uint i = 0; i < chains.length; i++) {
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
    ) external override returns (bytes32[] memory sequenceNumbers) {
        if (msg.sender != address(this)) {
            revert AccessError.Unauthorized(msg.sender);
        }
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();
        wcc.broadcast(chainIds, message, gasLimit);
    }

    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory additionalVaas,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) external payable {
        CrossChainWormhole.Data storage wcc = CrossChainWormhole.load();

        if (msg.sender != address(wcc.recv)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        address sourceAddr = address(uint160(uint(sourceAddress)));
        if (sourceAddr != address(this)) {
            revert AccessError.Unauthorized(sourceAddr);
        }

        if (wcc.selectorToChainId[sourceChain] == 0) {
            revert CrossChain.UnsupportedNetwork(sourceChain);
        }

        (bool success, bytes memory result) = address(this).call(payload);

        if (!success) {
            uint len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        emit ProcessedWormholeMessage(payload, result);
    }
}
