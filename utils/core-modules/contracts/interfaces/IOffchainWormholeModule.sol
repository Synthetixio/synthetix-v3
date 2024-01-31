//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWormholeRelayer, IWormholeRelayerSend, IWormholeRelayerDelivery} from "./external/IWormholeRelayer.sol";
import {IWormholeERC7412Receiver} from "./external/IWormholeERC7412Receiver.sol";

/**
 * @title Module with assorted utility functions.
 */
interface IOffchainWormholeModule {
    event ProcessedWormholeMessage(bytes payload, bytes result);

    /**
     * @notice Allows for owner to set information for cross chain protocols with wormhole
     * @param send The address of the WormholeRelayerSend contract
     * @param recv The address of the WormholeRelayerDelivery contract
     * @param read The address of the offchain read contract for wormhole
     * @param supportedNetworks The list of supported chain ids for the cross chain protocol
     * @param selectors Mapping of selectors used for wormhole related to the supportedNetworks
     */
    function configureWormholeCrossChain(
        IWormholeRelayerSend send,
        IWormholeRelayerDelivery recv,
        IWormholeERC7412Receiver read,
        uint64[] memory supportedNetworks,
        uint16[] memory selectors
    ) external;

    function readCrossChainWormhole(
        bytes32 /* subscriptionId */,
        uint64[] memory chains,
        bytes memory call,
        uint256 /* gasLimit */
    ) external returns (bytes[] memory responses);

    function sendWormholeMessage(
        uint64[] memory chainIds,
        bytes memory message,
        uint256 gasLimit
    ) external;
}
