//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWormhole} from "./../interfaces/IWormhole.sol";
import {IWormholeReceiver} from "./../interfaces/IWormholeReceiver.sol";
import "../storage/WormholeCrossChain.sol";

/**
 * @title Module with assorted cross-chain functions.
 */
contract WormholeCrossChainModule is IWormholeReceiver {
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
        require(msg.sender == address(wh.wormholeRelayer), "Only relayer allowed");

        (IWormhole.VM memory vm, bool valid, string memory reason) = wh
            .wormholeCore
            .parseAndVerifyVM(encodedMsg);

        //1. Check Wormhole Guardian Signatures
        //  If the VM is NOT valid, will return the reason it's not valid
        //  If the VM IS valid, reason will be blank
        require(valid, reason);

        //2. Check if the Emitter Chain contract is registered
        require(
            wh.registeredEmitters[vm.emitterChainId] == vm.emitterAddress,
            "Invalid Emitter Address!"
        );

        //3. Check that the message hasn't already been processed
        require(!wh.hasProcessedMessage[vm.hash], "Message already processed");
        wh.hasProcessedMessage[vm.hash] = true;

        // do the thing!
        (bool success, ) = address(this).call(vm.payload);
        require(success, "Failed to execute payload");
    }

    function transmit(
        WormholeCrossChain.Data storage self,
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 gasLimit
    ) internal returns (uint64 sequence) {
        (uint256 requiredMsgValue, ) = self.wormholeRelayer.quoteEVMDeliveryPrice(
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
            require(msg.value >= requiredMsgValue, "Insufficient msg value");
            sequence = self.wormholeRelayer.sendPayloadToEvm(
                targetChain,
                targetAddress,
                payload,
                receiverValue,
                gasLimit
            );
        }
    }

    /**
     * @notice Returns the cost (in wei) of a greeting
     */
    function quoteCrossChainGreeting(
        uint16 targetChain,
        uint256 gasLimit
    ) public view returns (uint256 cost) {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        // Cost of requesting a message to be sent to
        // chain 'targetChain' with a gasLimit of 'GAS_LIMIT'
        (cost, ) = wh.wormholeRelayer.quoteEVMDeliveryPrice(targetChain, 0, gasLimit);
    }

    function toAddress(bytes32 _bytes) internal pure returns (address) {
        return address(uint160(uint256(_bytes)));
    }

    function toBytes32(address _address) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
    }
}
