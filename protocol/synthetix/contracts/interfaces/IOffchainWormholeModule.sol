//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IWormholeRelayer.sol";
import "./external/IWormholeCrossChainRead.sol";

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
        IWormholeCrossChainRead read,
        uint64[] memory supportedNetworks,
        uint16[] memory selectors
    ) external;
}
