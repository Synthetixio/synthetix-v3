//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {IWormhole} from "./../interfaces/IWormhole.sol";
import {IWormholeRelayer} from "./../interfaces/IWormholeRelayer.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title System wide configuration for anything related to cross-chain
 */
library WormholeCrossChain {
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    event NewEmitter(uint64 newChainId, address emitterAddress);

    event NewSupportedCrossChainNetwork(uint64 newChainId);

    event ProcessedWormholeMessage(bytes payload, bytes result);

    error UnsupportedNetwork(uint64);

    bytes32 private constant _SLOT_WORMHOLE_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.core-modules.WormholeCrossChain"));

    struct Data {
        IWormhole wormholeCore;
        IWormholeRelayer wormholeRelayer;
        SetUtil.UintSet supportedNetworks;
        mapping(uint16 => bytes32) registeredEmitters; //chain id => emitter address (bytes32)
        mapping(bytes32 => bool) hasProcessedMessage;
    }

    function addSupportedNetwork(Data storage self, uint16 chainId) internal {
        self.supportedNetworks.add(chainId);
        emit NewSupportedCrossChainNetwork(chainId);
    }

    function addEmitter(Data storage self, uint16 chainId, address emitter) internal {
        self.registeredEmitters[chainId] = bytes32(uint256(uint160(emitter)));
        emit NewEmitter(chainId, emitter);
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_WORMHOLE_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    function validateChainId(Data storage self, uint256 chainId) internal view {
        if (!self.supportedNetworks.contains(chainId)) {
            revert UnsupportedNetwork(chainId.to64());
        }
    }

    function onlyCrossChain() internal view {
        if (ERC2771Context._msgSender() != address(this)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    function emitterAddress() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    function getChainIdAt(Data storage self, uint64 index) internal view returns (uint64) {
        return self.supportedNetworks.valueAt(index + 1).to64();
    }

    function getSupportedNetworks(Data storage self) internal view returns (uint64[] memory) {
        SetUtil.UintSet storage supportedNetworks = self.supportedNetworks;
        uint256[] memory supportedChains = supportedNetworks.values();
        uint64[] memory chains = new uint64[](supportedChains.length);
        for (uint i = 0; i < supportedChains.length; i++) {
            uint64 chainId = supportedChains[i].to64();
            chains[i] = chainId;
        }
        return chains;
    }

    function getWormholeRelayer() internal view returns (IWormholeRelayer) {
        Data storage wh = load();
        return wh.wormholeRelayer;
    }
}
