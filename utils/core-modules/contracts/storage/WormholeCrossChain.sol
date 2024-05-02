//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWormhole} from "./../interfaces/IWormhole.sol";

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
/**
 * @title System wide configuration for anything related to cross-chain
 */
library WormholeCrossChain {
    using SetUtil for SetUtil.UintSet;
    using SafeCastU256 for uint256;

    struct SampleMessage {
        address recipient;
        string message;
    }

    bytes32 private constant _SLOT_WORMHOLE_CROSS_CHAIN =
        keccak256(abi.encode("io.synthetix.core-modules.WormholeCrossChain"));

    struct Data {
        IWormhole wormhole; // OP mainnet: 0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722
        uint32 nonce;
        mapping(uint16 => bytes32) registeredContracts;
        mapping(bytes32 => bool) hasProcessedMessage;
    }

    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_WORMHOLE_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }

    function onlyCrossChain() internal view {
        if (ERC2771Context._msgSender() != address(this)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    function getMessageForAddress(
        address recipient,
        string calldata message
    ) external pure returns (bytes memory) {
        return abi.encode(SampleMessage(recipient, message));
    }

    function emitterAddress() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }
}
