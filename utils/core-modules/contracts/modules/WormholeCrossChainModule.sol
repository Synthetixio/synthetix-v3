//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IWormhole} from "../interfaces/IWormhole.sol";
import {IWormholeReceiver} from "../interfaces/IWormholeReceiver.sol";
import {IWormholeRelayer} from "../interfaces/IWormholeRelayer.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {WormholeCrossChain} from "../storage/WormholeCrossChain.sol";

/**
 * @title Module with assorted cross-chain functions.
 */
contract WormholeCrossChainModule is IWormholeReceiver {
    error OnlyRelayer();
    error InsufficientValue();
    error InvalidVM(string reason);
    error MessageAlreadyProcessed();
    error UnregisteredEmitter();

    event MessageSent(string indexed message); //TODO delete once working

    function sendMessage(string memory message) external payable {
        //TODO delete once working
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        uint16[] memory chains = WormholeCrossChain.getSupportedNetworks(wh);
        broadcast(wh, chains, abi.encodeWithSelector(this._recMessage.selector, message), 0);
    }

    function _recMessage(string memory message) external {
        //TODO delete once working
        WormholeCrossChain.onlyCrossChain();
        emit MessageSent(message);
    }

    ///@dev Sets supported emitters and chain ids
    function setRegisteredEmitters(uint16[] memory chainIds, address[] memory emitters) external {
        OwnableStorage.onlyOwner();

        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();

        if (chainIds.length != emitters.length) {
            revert ParameterError.InvalidParameter(
                "emitters",
                "must match length of supportedNetworks"
            );
        }

        for (uint256 i = 0; i < chainIds.length; i++) {
            WormholeCrossChain.addSupportedNetwork(wh, chainIds[i]);
            WormholeCrossChain.addEmitter(wh, chainIds[i], emitters[i]);
        }
    }

    ///@dev Implementation from IWormholeReciever, necessary to receive and process messages from the WormholeRelayer
    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory /*additionalMessages*/,
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 deliveryHash
    ) external payable override {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        if (ERC2771Context._msgSender() != address(wh.wormholeRelayer)) revert OnlyRelayer();

        if (wh.registeredEmitters[sourceChain] != sourceAddress) revert UnregisteredEmitter();

        if (wh.hasProcessedMessage[deliveryHash]) revert MessageAlreadyProcessed();
        wh.hasProcessedMessage[deliveryHash] = true;

        (bool success, bytes memory result) = address(this).call(payload);
        _checkSuccess(success, result);
    }

    function broadcast(
        WormholeCrossChain.Data storage self,
        uint16[] memory targetChains,
        // address /*targetAddress*/,
        bytes memory payload,
        uint256 receiverValue
    ) internal returns (uint64 sequence) {
        uint256 targetChainsLength = targetChains.length;
        uint256 totalCost = receiverValue * targetChainsLength;
        for (uint256 i; i < targetChainsLength; i++) {
            uint16 targetChain = targetChains[i];
            if (targetChain == self.wormholeCore.chainId()) {
                // If the target chain is the same as the current chain, we can call the method directly
                (bool success, bytes memory result) = address(this).call{value: receiverValue}(
                    payload
                );
                _checkSuccess(success, result);
            } else {
                // If the target chain is different, we need to transmit the message to the WormholeRelayer
                // to be sent to the target chain
                uint256 cost = quoteCrossChainDeliveryPrice(
                    targetChain,
                    receiverValue,
                    self.gasLimit
                );
                sequence = transmit(
                    self,
                    targetChain,
                    toAddress(self.registeredEmitters[targetChain]),
                    payload,
                    receiverValue,
                    cost
                );
                totalCost += cost;
            }
        }
        uint256 refundAmount = msg.value - totalCost;
        if (refundAmount > 0) {
            (bool success, bytes memory result) = ERC2771Context._msgSender().call{
                value: refundAmount
            }("");
            _checkSuccess(success, result);
        }
    }

    ///@dev Transmits a message to another chain
    function transmit(
        WormholeCrossChain.Data storage self,
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 cost
    ) internal returns (uint64 sequence) {
        sequence = self.wormholeRelayer.sendPayloadToEvm{value: cost}(
            targetChain,
            targetAddress,
            payload,
            receiverValue,
            self.gasLimit,
            self.wormholeCore.chainId(),
            ERC2771Context._msgSender()
        );
    }

    function setGasLimit(uint256 gasLimit) external {
        OwnableStorage.onlyOwner();
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        WormholeCrossChain.setGasLimit(wh, gasLimit);
    }

    ///@dev returns wormhole core contract address
    function getWormholeCore() external view returns (IWormhole) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        return wh.wormholeCore;
    }

    ///@dev returns wormhole relayer contract address
    function getWormholeRelayer() external view returns (IWormholeRelayer) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        return wh.wormholeRelayer;
    }

    function getSupportedNetworks() external view returns (uint16[] memory) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        return WormholeCrossChain.getSupportedNetworks(wh);
    }

    function getRegisteredEmitters() external view returns (bytes32[] memory) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        return WormholeCrossChain.getRegisteredEmitters(wh);
    }

    function hasProcessedMsg(bytes32 deliveryHash) external view returns (bool) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        return wh.hasProcessedMessage[deliveryHash];
    }

    ///@dev Returns the cost (in wei) of a cross-chain message
    ///@notice all chain ids are specific to wormhole, and is not in parity with standard network ids https://docs.wormhole.com/wormhole/reference/constants#chain-ids
    function quoteCrossChainDeliveryPrice(
        uint16 targetChain,
        uint256 receiverValue,
        uint256 gasLimit
    ) public view returns (uint256 cost) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        // Cost of requesting a message to be sent to `targetChain` with `gasLimit`
        (cost, ) = wh.wormholeRelayer.quoteEVMDeliveryPrice(targetChain, receiverValue, gasLimit);
    }

    ///@dev wormhole contracts store addresses as bytes, which is why we need a function to convert between types
    function toAddress(bytes32 _bytes) internal pure returns (address) {
        // solhint-disable-next-line
        return address(uint160(uint256(_bytes)));
    }

    ///@dev wormhole contracts store addresses as bytes, which is why we need a function to convert between types
    function toBytes32(address _address) internal pure returns (bytes32) {
        // solhint-disable-next-line
        return bytes32(uint256(uint160(_address)));
    }

    function _checkSuccess(bool success, bytes memory result) private pure {
        if (!success) {
            uint256 len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }
    }
}
