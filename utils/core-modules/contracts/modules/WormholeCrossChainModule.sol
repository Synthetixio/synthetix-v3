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

    function receiveWormholeMessages(
        bytes memory payload,
        bytes[] memory, // additionalVaas
        bytes32, // address that called 'sendPayloadToEvm' (HelloWormhole contract address)
        uint16 sourceChain,
        bytes32 // unique identifier of delivery
    ) public payable override {
        WormholeCrossChain.Data storage wh = WormholeCrossChain.load();
        require(msg.sender == address(wh.wormhole), "Only relayer allowed");

        // Parse the payload and do the corresponding actions!
        (address sender, string memory greeting) = abi.decode(payload, (address, string));
    }
}
