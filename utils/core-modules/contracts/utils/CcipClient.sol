// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

library CcipClient {
    struct EVMTokenAmount {
        address token; // token address on the local chain
        uint256 amount;
    }

    struct Any2EVMMessage {
        bytes32 messageId; // MessageId corresponding to ccipSend on source
        uint64 sourceChainSelector;
        bytes sender; // abi.decode(sender) if coming from an EVM chain
        bytes data; // payload sent in original message
        EVMTokenAmount[] tokenAmounts;
    }

    // If extraArgs is empty bytes, the default is
    // 200k gas limit and strict = false.
    struct EVM2AnyMessage {
        bytes receiver; // abi.encode(receiver address) for dest EVM chains
        bytes data; // Data payload
        EVMTokenAmount[] tokenAmounts; // Token transfers
        address feeToken; // Address of feeToken. address(0) means you will send msg.value.
        bytes extraArgs; // Populate this with _argsToBytes(EVMExtraArgsV1)
    }

    // extraArgs will evolve to support new features
    // bytes4(keccak256("CCIP EVMExtraArgsV1"));
    bytes4 public constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;
    struct EVMExtraArgsV1 {
        uint256 gasLimit; // ATTENTION!!! MAX GAS LIMIT 4M FOR ALPHA TESTING
        bool strict; // See strict sequencing details below.
    }

    function _argsToBytes(
        EVMExtraArgsV1 memory extraArgs
    ) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EVM_EXTRA_ARGS_V1_TAG, extraArgs);
    }
}
