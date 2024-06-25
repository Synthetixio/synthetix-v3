//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IWormhole} from "./../interfaces/IWormhole.sol";
import {IWormholeReceiver} from "./../interfaces/IWormholeReceiver.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "../storage/WormholeCrossChain.sol";

/**
 * @title Module with assorted cross-chain functions.
 */
contract WormholeCrossChainModule is IWormholeReceiver {
    error OnlyRelayer();
    error InsufficientValue();
    error InvalidVM(string reason);
    error MessageAlreadyProcessed();
    error UnregisteredEmitter();

    event logCCMessage(string message);

    function sendCCMessage(
        string memory message,
        uint16 targetChain,
        address targetAddress
    ) external payable {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        bytes memory payload = abi.encodeWithSignature("recCCMessage(string)", message);
        transmit(wh, targetChain, targetAddress, payload, 0, 100000);
    }

    function recCCMessage(string memory message) external {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        require(address(wh.wormholeRelayer) == msg.sender, "Only relayer");
        emit logCCMessage(message);
    }

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

    function receiveEncodedMsg(
        bytes memory encodedMsg,
        bytes[] memory, // additionalVaas
        bytes32, // sender
        uint16, // sourceChain
        bytes32 //deliveryId
    ) public payable override {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        if (ERC2771Context._msgSender() != address(wh.wormholeRelayer)) revert OnlyRelayer();

        (IWormhole.VM memory vm, bool valid, string memory reason) = wh
            .wormholeCore
            .parseAndVerifyVM(encodedMsg);

        //1. Check Wormhole Guardian Signatures
        //  If the VM is NOT valid, will return the reason it's not valid
        //  If the VM IS valid, reason will be blank
        if (!valid) revert InvalidVM(reason);

        //2. Check if the Emitter Chain contract is registered
        if (wh.registeredEmitters[vm.emitterChainId] != vm.emitterAddress)
            revert UnregisteredEmitter();

        //3. Check that the message hasn't already been processed
        if (wh.hasProcessedMessage[vm.hash]) revert MessageAlreadyProcessed();
        wh.hasProcessedMessage[vm.hash] = true;

        // do the thing!
        (bool success, bytes memory result) = address(this).call(vm.payload);
        _checkSuccess(success, result);
    }

    function transmit(
        WormholeCrossChain.Data storage self,
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 gasLimit
    ) internal returns (uint64 sequence) {
        (uint256 cost, ) = self.wormholeRelayer.quoteEVMDeliveryPrice(
            targetChain,
            receiverValue,
            gasLimit
        );
        if (targetChain == self.wormholeCore.chainId()) {
            // If the target chain is the same as the current chain, we can call the method directly
            (bool success, bytes memory result) = address(this).call(payload);
            if (!success) {
                uint256 len = result.length;
                assembly {
                    revert(add(result, 0x20), len)
                }
            }
        } else {
            // If the target chain is different, we need to send the message to the WormholeRelayer
            // to be sent to the target chain
            if (msg.value < cost) revert InsufficientValue();
            sequence = self.wormholeRelayer.sendPayloadToEvm{value: cost}(
                targetChain,
                targetAddress,
                payload,
                receiverValue,
                gasLimit
                // TODO: do we add refund addresses? who should get the refund and on what chain?
            );
        }
    }

    /**
     * @notice Returns the cost (in wei) of a cross-chain message
     */
    function quoteCrossChainDeliveryPrice(
        uint16 targetChain,
        uint256 receiverValue,
        uint256 gasLimit
    ) public view returns (uint256 cost) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        // Cost of requesting a message to be sent to
        // chain 'targetChain' with a gasLimit of 'GAS_LIMIT'
        (cost, ) = wh.wormholeRelayer.quoteEVMDeliveryPrice(targetChain, receiverValue, gasLimit);
    }

    function toAddress(bytes32 _bytes) internal pure returns (address) {
        // solhint-disable-next-line
        return address(uint160(uint256(_bytes)));
    }

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
