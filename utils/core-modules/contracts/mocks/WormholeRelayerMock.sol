//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {IWormhole} from "../interfaces/IWormhole.sol";
import {IWormholeReceiver} from "../interfaces/IWormholeReceiver.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

contract WormholeRelayerMock {
    error InvalidTargetChain(uint16 targetChain);

    event SendEvent(
        uint64 indexed sequence,
        uint256 deliveryQuote,
        uint256 paymentForExtraReceiverValue
    );

    event Delivery(
        address indexed recipientContract,
        uint16 indexed sourceChain,
        uint64 indexed sequence,
        bytes32 deliveryVaaHash,
        uint8 status,
        uint256 gasUsed,
        uint8 refundStatus,
        bytes additionalStatusInfo,
        bytes overridesInfo
    );

    IWormhole private immutable WORMHOLE;

    constructor(address _wormhole) {
        WORMHOLE = IWormhole(_wormhole);
    }

    function sendPayloadToEvm(
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 gasLimit
    ) external payable returns (uint64 sequence) {
        bytes memory _payload = abi.encode(
            targetChain,
            WORMHOLE.chainId(),
            targetAddress,
            ERC2771Context._msgSender(), // emitterAddress
            sequence,
            payload,
            receiverValue,
            gasLimit
        );
        sequence = WORMHOLE.publishMessage{value: 0}(0, _payload, 1);
        emit SendEvent(sequence, 0, 0);
    }

    function deliver(
        bytes[] memory, // encodedVMs
        bytes memory encodedDeliveryVAA,
        address payable, // relayerRefundAddress
        bytes memory // deliveryOverrides
    ) public payable {
        // Parse and verify VAA containing delivery instructions, revert if invalid
        (IWormhole.VM memory vm, , ) = WORMHOLE.parseAndVerifyVM(encodedDeliveryVAA);

        (
            uint16 targetChain,
            uint16 emitterChainId,
            address targetAddress,
            address emitterAddress,
            uint64 sequence,
            ,
            uint256 receiverValue,

        ) = abi.decode(
                encodedDeliveryVAA,
                (uint16, uint16, address, address, uint64, bytes, uint256, uint256)
            );

        IWormholeReceiver targetReceiver = IWormholeReceiver(targetAddress);

        if (targetChain != WORMHOLE.chainId()) revert InvalidTargetChain(targetChain);

        targetReceiver.receiveWormholeMessages{value: receiverValue}(
            encodedDeliveryVAA,
            new bytes[](0),
            toBytes32(emitterAddress),
            emitterChainId,
            vm.hash
        );

        emit Delivery(
            targetAddress,
            emitterChainId,
            sequence,
            vm.hash,
            1,
            0,
            6,
            bytes(""),
            bytes("")
        );
    }

    function quoteEVMDeliveryPrice(
        uint16, // targetChain
        uint256, // receiverValue
        uint256 // gasLimit
    ) public pure returns (uint256 nativePriceQuote, uint256 targetChainRefundPerGasUnused) {
        return (0, 0);
    }

    function toBytes32(address _address) internal pure returns (bytes32) {
        // solhint-disable-next-line
        return bytes32(uint256(uint160(_address)));
    }
}
