//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {IWormhole} from "../interfaces/IWormhole.sol";
import {IWormholeRelayer} from "../interfaces/IWormholeRelayer.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title System wide configuration for anything related to cross-chain
 */
library WormholeCrossChain {
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    event CrossChainNetworkSupportRemoved(uint64 chainId);

    event EmitterSet(uint64 newChainId, address emitterAddress);

    event NewSupportedCrossChainNetwork(uint64 newChainId);

    event ProcessedWormholeMessage(bytes payload, bytes result);

    error UnsupportedNetwork(uint64);

    bytes32 private constant _SLOT_WORMHOLE_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.core-modules.WormholeCrossChain"));

    struct Data {
        IWormhole wormholeCore;
        IWormholeRelayer wormholeRelayer;
        uint256 gasLimit;
        SetUtil.UintSet supportedNetworks;
        mapping(uint16 => bytes32) registeredEmitters; //chain id => emitter address (bytes32). If we want to add support for multiple emitters per chain, we pack the address and chain into a single bytes32 that maps to boolean.
        mapping(bytes32 => bool) hasProcessedMessage;
    }

    ///@dev adds supported network to storage, used for cross-chain network verification
    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function addSupportedNetwork(Data storage self, uint16 chainId) internal {
        if (!self.supportedNetworks.contains(chainId)) {
            self.supportedNetworks.add(chainId);
            emit NewSupportedCrossChainNetwork(chainId);
        }
    }

    ///@dev removes supported network from storage
    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function removeSupportedNetwork(Data storage self, uint16 chainId) internal {
        if (!self.supportedNetworks.contains(chainId)) revert UnsupportedNetwork(chainId);
        self.supportedNetworks.remove(chainId);
        emit CrossChainNetworkSupportRemoved(chainId);
    }

    ///@dev adds or removes registered emitter to storage, used for cross-chain contract verification
    ///@dev to remove an emitter, set the address to address(0)
    function setEmitter(Data storage self, uint16 chainId, address emitter) internal {
        // solhint-disable-next-line
        self.registeredEmitters[chainId] = bytes32(uint256(uint160(emitter)));
        emit EmitterSet(chainId, emitter);
    }

    function setGasLimit(Data storage self, uint256 gasLimit) internal {
        self.gasLimit = gasLimit;
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_WORMHOLE_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    ///@dev confirms that the chainId is registered in storage, reverts if not
    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
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
        // solhint-disable-next-line
        return bytes32(uint256(uint160(address(this))));
    }

    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function getChainIdAt(Data storage self, uint64 index) internal view returns (uint16) {
        return self.supportedNetworks.valueAt(index + 1).to16();
    }

    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function getSupportedNetworks(Data storage self) internal view returns (uint16[] memory) {
        SetUtil.UintSet storage supportedNetworks = self.supportedNetworks;
        uint256[] memory supportedChains = supportedNetworks.values();
        uint16[] memory chains = new uint16[](supportedChains.length);
        for (uint256 i = 0; i < supportedChains.length; i++) {
            uint16 chainId = supportedChains[i].to16();
            chains[i] = chainId;
        }
        return chains;
    }

    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function getRegisteredEmitters(Data storage self) internal view returns (bytes32[] memory) {
        uint16[] memory chainIds = getSupportedNetworks(self);
        bytes32[] memory emitters = new bytes32[](chainIds.length);
        for (uint256 i = 0; i < chainIds.length; i++) {
            emitters[i] = self.registeredEmitters[chainIds[i]];
        }
        return emitters;
    }

    function hasProcessedMsg(Data storage self, bytes32 msgHash) internal view returns (bool) {
        return self.hasProcessedMessage[msgHash];
    }
}
