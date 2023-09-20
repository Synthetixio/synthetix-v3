//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../interfaces/external/IWormholeCrossChainRead.sol";
import "../interfaces/external/IWormholeRelayer.sol";
import "../utils/CrossChain.sol";

/**
 * @title System wide configuration for anything
 */
library CrossChainWormhole {
    using SetUtil for SetUtil.UintSet;

    bytes32 private constant _SLOT_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.synthetix.CrossChainWormhole"));

    struct Data {
        IWormholeCrossChainRead crossChainRead;
        IWormholeRelayerSend sender;
        IWormholeRelayerDelivery recv;
        SetUtil.UintSet supportedNetworks;
        mapping(uint64 => uint16) chainIdToSelector;
        mapping(uint16 => uint64) selectorToChainId;
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    function getCrossChainData(
        uint64 chainId,
        bytes memory crossChainData
    ) internal returns (bytes memory) {
        // wormhole is ERC7412 compliant so all we need to do is call them foir the data and the standard will do the rest
        return
            load().crossChainRead.getCrossChainData(
                load().chainIdToSelector[chainId],
                address(this),
                crossChainData
            );
    }

    function transmit(
        Data storage self,
        uint64 chainId,
        bytes memory data,
        uint256 gasLimit
    ) internal returns (uint256 gasTokenUsed) {
        uint64[] memory chains = new uint64[](1);
        chains[0] = chainId;
        return broadcast(self, chains, data, gasLimit);
    }

    /**
     * @dev Sends a message to one or more chains
     */
    function broadcast(
        Data storage self,
        uint64[] memory chains,
        bytes memory data,
        uint256 gasLimit
    ) internal returns (uint256 gasTokenUsed) {
        IWormholeRelayerSend wormholeSender = self.sender;

        for (uint i = 0; i < chains.length; i++) {
            if (chains[i] == block.chainid) {
                (bool success, bytes memory result) = address(this).call(data);

                if (!success) {
                    uint256 len = result.length;
                    assembly {
                        revert(result, len)
                    }
                }
            } else {
                uint16 chainSelector = self.chainIdToSelector[chains[i]];

                (uint256 fee, ) = wormholeSender.quoteEVMDeliveryPrice(chainSelector, 0, gasLimit);

                // need to check sufficient fee here or else the error is very confusing
                if (address(this).balance < fee) {
                    revert CrossChain.InsufficientBridgeFee(fee, address(this).balance);
                }

                wormholeSender.sendPayloadToEvm{value: fee}(
                    chainSelector,
                    address(this),
                    data,
                    0,
                    gasLimit
                );

                gasTokenUsed += fee;
            }
        }
    }
}
