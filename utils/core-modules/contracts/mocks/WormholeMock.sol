//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IWormhole} from "../interfaces/IWormhole.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

contract WormholeMock {
    event LogMessagePublished(
        address indexed sender,
        uint64 sequence,
        uint32 nonce,
        bytes payload,
        uint8 consistencyLevel
    );

    uint256 public immutable CHAIN_ID;

    constructor(uint256 _chainId) {
        CHAIN_ID = _chainId;
    }

    mapping(address => uint64) public sequences;

    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence) {
        address sender = ERC2771Context._msgSender();
        sequence = sequences[sender]++;
        emit LogMessagePublished(sender, sequence, nonce, payload, consistencyLevel);
    }

    function parseAndVerifyVM(
        bytes calldata encodedVM
    ) external view returns (IWormhole.VM memory vm, bool valid, string memory reason) {
        (
            ,
            // uint16 targetChain
            uint16 emitterChain, // address targetAddress
            ,
            address emitterAddress,
            uint64 sequence,
            bytes memory payload, // uint256 receiverValue
            ,

        ) = // uint256 gasLimit
            abi.decode(
                encodedVM,
                (uint16, uint16, address, address, uint64, bytes, uint256, uint256)
            );

        IWormhole.VM memory vmParsed = IWormhole.VM({
            version: 0,
            // solhint-disable-next-line
            timestamp: uint32(block.timestamp),
            nonce: 0, // unknown
            emitterChainId: emitterChain, //unknown
            emitterAddress: toBytes32(emitterAddress),
            sequence: sequence, //unknown
            consistencyLevel: 1, // we know its 1, but irl it's variable and unknown in this scope
            payload: payload,
            guardianSetIndex: 0,
            signatures: new IWormhole.Signature[](0), // Assuming signatures is an array of bytes
            hash: keccak256(payload)
        });

        return (vmParsed, true, "");
    }

    function messageFee() external pure returns (uint256) {
        return 0;
    }

    function chainId() external view returns (uint256) {
        return CHAIN_ID;
    }

    function toBytes32(address _address) internal pure returns (bytes32) {
        // solhint-disable-next-line
        return bytes32(uint256(uint160(_address)));
    }
}
