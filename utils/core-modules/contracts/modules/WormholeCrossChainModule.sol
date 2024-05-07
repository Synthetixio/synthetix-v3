//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWormhole} from "./../interfaces/IWormhole.sol";
import {IWormholeReceiver} from "./../interfaces/IWormholeReceiver.sol";
import "../storage/WormholeCrossChain.sol";
// import "wormhole-solidity-sdk/interfaces/IWormholeRelayer.sol";
// import "wormhole-solidity-sdk/interfaces/IWormholeReceiver.sol";

/**
 * @title Module with assorted cross-chain functions.
 */
contract WormholeCrossChainModule is IWormholeReceiver {
    struct DemoMessage {
        address recipient;
        string message;
    }

    function sendMessage(IWormhole wormhole, bytes memory fullMessage) public payable {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        wormhole.publishMessage{value: wormhole.messageFee()}(wh.nonce, fullMessage, 200);
    }

    function registerEmitter(uint16 chainId, bytes32 emitterAddress) public {
        // require(msg.sender == owner);
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        wh.registeredContracts[chainId] = emitterAddress;
    }

    function receiveEncodedMsg(
        bytes memory encodedMsg,
        bytes[] memory additionalVaas, // additionalVaas
        bytes32 sender, // address that called 'sendPayloadToEvm' (HelloWormhole contract address)
        uint16 sourceChain,
        bytes32 deliveryId
    ) public payable override {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        // require(msg.sender == address(wh.wormhole), "Only relayer allowed");

        (IWormhole.VM memory vm, bool valid, string memory reason) = wh.wormhole.parseAndVerifyVM(
            encodedMsg
        );

        //1. Check Wormhole Guardian Signatures
        //  If the VM is NOT valid, will return the reason it's not valid
        //  If the VM IS valid, reason will be blank
        require(valid, reason);

        //2. Check if the Emitter Chain contract is registered
        require(
            wh.registeredContracts[vm.emitterChainId] == vm.emitterAddress,
            "Invalid Emitter Address!"
        );

        //3. Check that the message hasn't already been processed
        require(!wh.hasProcessedMessage[vm.hash], "Message already processed");
        wh.hasProcessedMessage[vm.hash] = true;

        // do the thing!
        (bool success, bytes memory result) = address(this).call(vm.payload);
        require(success, "Failed to execute payload");
    }
}
