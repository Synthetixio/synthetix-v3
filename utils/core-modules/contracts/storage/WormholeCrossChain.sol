//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {IWormhole} from "./../interfaces/IWormhole.sol";
import {IWormholeRelayer} from "./../interfaces/IWormholeRelayer.sol";
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

    ///@dev adds supported network to storage, used for cross-chain network verification
    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids //TODO add link here
    function addSupportedNetwork(Data storage self, uint16 chainId) internal {
        self.supportedNetworks.add(chainId);
        emit NewSupportedCrossChainNetwork(chainId);
    }

    ///@dev adds registered emitter to storage, used for cross-chain contract verification
    function addEmitter(Data storage self, uint16 chainId, address emitter) internal {
        // solhint-disable-next-line
        self.registeredEmitters[chainId] = bytes32(uint256(uint160(emitter)));
        emit NewEmitter(chainId, emitter);
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_WORMHOLE_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    ///@dev confirms that the chainId is registered in storage, reverts if not
    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids //TODO add link here
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

    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids //TODO add link here
    function getChainIdAt(Data storage self, uint64 index) internal view returns (uint64) {
        return self.supportedNetworks.valueAt(index + 1).to64();
    }

    ///@dev all chain ids are specific to wormhole, and is not in parity with standard network ids //TODO add link here
    function getSupportedNetworks(Data storage self) internal view returns (uint64[] memory) {
        SetUtil.UintSet storage supportedNetworks = self.supportedNetworks;
        uint256[] memory supportedChains = supportedNetworks.values();
        uint64[] memory chains = new uint64[](supportedChains.length);
        for (uint256 i = 0; i < supportedChains.length; i++) {
            uint64 chainId = supportedChains[i].to64();
            chains[i] = chainId;
        }
        return chains;
    }
}
