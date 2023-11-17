// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC2771Forwarder, Address} from "../lib/openzeppelin-contracts/contracts/metatx/ERC2771Forwarder.sol";

/* solhint-disable meta-transactions/no-msg-sender */

/// @title TrustedMulticallForwarder
/// @notice Aggregate results from multiple function calls
/// @dev Derived from Multicall3
/// @dev Modified for support to bubble errors
/// @dev Multicall & Multicall2 backwards-compatible
/// @dev Aggregate methods are marked `payable` to save 24 gas per call
/// @dev Includes ERC-2771 trusted forwarder functionality
/// @author Michael Elliot <mike@makerdao.com>
/// @author Joshua Levine <joshua@makerdao.com>
/// @author Nick Johnson <arachnid@notdot.net>
/// @author Andreas Bigger <andreas@nascent.xyz>
/// @author Matt Solomon <matt@mattsolomon.dev>
/// @author Daniel Beal <db@cc.snxdao.io>
/// @author Noah Litvin <noah.litvin@gmail.com>
/// @author Jared Borders <jaredborders@pm.me>
contract TrustedMulticallForwarder is ERC2771Forwarder {
    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    constructor() ERC2771Forwarder("trusted-multicall-forwarder") {}

    /// @notice Backwards-compatible call aggregation with Multicall
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return returnData An array of bytes containing the responses
    function aggregate(
        Call[] calldata calls
    ) public returns (uint256 blockNumber, bytes[] memory returnData) {
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ) {
            bool success;
            call = calls[i];
            (success, returnData[i]) = call.target.call(
                abi.encodePacked(call.callData, msg.sender)
            );
            if (!success) {
                bytes memory revertData = returnData[i];
                uint256 len = revertData.length;
                assembly {
                    revert(add(revertData, 0x20), len)
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls without requiring success
    /// @param requireSuccess If true, require all calls to succeed
    /// @param calls An array of Call structs
    /// @return returnData An array of Result structs
    function tryAggregate(
        bool requireSuccess,
        Call[] calldata calls
    ) public returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            call = calls[i];
            (result.success, result.returnData) = call.target.call(
                abi.encodePacked(call.callData, msg.sender)
            );
            if (requireSuccess && !result.success) {
                bytes memory revertData = result.returnData;
                uint256 len = revertData.length;
                assembly {
                    revert(add(revertData, 0x20), len)
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function tryBlockAndAggregate(
        bool requireSuccess,
        Call[] calldata calls
    ) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        blockNumber = block.number;
        blockHash = blockhash(block.number);
        returnData = tryAggregate(requireSuccess, calls);
    }

    /// @notice Backwards-compatible with Multicall2
    /// @notice Aggregate calls and allow failures using tryAggregate
    /// @param calls An array of Call structs
    /// @return blockNumber The block number where the calls were executed
    /// @return blockHash The hash of the block where the calls were executed
    /// @return returnData An array of Result structs
    function blockAndAggregate(
        Call[] calldata calls
    ) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        (blockNumber, blockHash, returnData) = tryBlockAndAggregate(true, calls);
    }

    /// @notice Aggregate calls, ensuring each returns success if required
    /// @param calls An array of Call3 structs
    /// @return returnData An array of Result structs
    function aggregate3(
        Call3[] calldata calls
    ) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call3 calldata calli;
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            calli = calls[i];
            (result.success, result.returnData) = calli.target.call(
                abi.encodePacked(calli.callData, msg.sender)
            );
            if (!calli.allowFailure && !result.success) {
                bytes memory revertData = result.returnData;
                uint256 len = revertData.length;
                assembly {
                    revert(add(revertData, 0x20), len)
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Aggregate calls with a msg value
    /// @notice Reverts if msg.value is less than the sum of the call values
    /// @param calls An array of Call3Value structs
    /// @return returnData An array of Result structs
    function aggregate3Value(
        Call3Value[] calldata calls
    ) public payable returns (Result[] memory returnData) {
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call3Value calldata calli;
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            calli = calls[i];
            uint256 val = calli.value;
            // Humanity will be a Type V Kardashev Civilization before this overflows - andreas
            // ~ 10^25 Wei in existence << ~ 10^76 size uint fits in a uint256
            unchecked {
                valAccumulator += val;
            }
            (result.success, result.returnData) = calli.target.call{value: val}(
                abi.encodePacked(calli.callData, msg.sender)
            );
            if (calli.allowFailure && !result.success) {
                bytes memory revertData = result.returnData;
                uint256 len = revertData.length;
                assembly {
                    revert(add(revertData, 0x20), len)
                }
            }
            unchecked {
                ++i;
            }
        }
        // Finally, make sure the msg.value == SUM(call[0...i].value)
        if (msg.value != valAccumulator) {
            revert ERC2771ForwarderMismatchedValue(valAccumulator, msg.value);
        }
    }

    /// @notice Aggregate ForwardRequestData objects
    /// @notice Reverts if msg.value does not equal the sum of the call values
    /// @notice Reverts if the msg.sender is the zero address
    /// @param requests An array of ForwardRequestData structs
    /// @return returnData An array of Result structs
    function executeBatch(
        ForwardRequestData[] calldata requests
    ) public payable returns (Result[] memory returnData) {
        uint256 length = requests.length;
        returnData = new Result[](length);

        ForwardRequestData calldata req;

        uint256 requestsValue;
        uint256 refundValue;

        for (uint256 i; i < length; ) {
            Result memory result = returnData[i];

            req = requests[i];
            requestsValue += requests[i].value;

            (bool isTrustedForwarder, bool active, bool signerMatch, address signer) = _validate(
                req
            );

            if (isTrustedForwarder && signerMatch && active) {
                // Nonce should be used before the call to prevent reusing by reentrancy
                uint256 currentNonce = _useNonce(signer);

                (result.success, result.returnData) = req.to.call{value: req.value, gas: req.gas}(
                    abi.encodePacked(req.data, req.from)
                );

                /// @dev see ERC2771Forwarder._checkForwardedGas() for further details
                if (gasleft() < req.gas / 63) {
                    assembly {
                        invalid()
                    }
                }

                emit ExecutedForwardRequest(signer, currentNonce, result.success);
            }

            /// @notice If the call was not successful, we refund the value to the msg.sender
            /// @dev unsuccessful calls are never reverted
            if (!result.success) {
                refundValue += requests[i].value;
            }

            unchecked {
                ++i;
            }
        }

        // The batch should revert if there's a mismatched msg.value provided
        // to avoid request value tampering
        if (requestsValue != msg.value) {
            revert ERC2771ForwarderMismatchedValue(requestsValue, msg.value);
        }

        // Some requests with value were invalid (possibly due to frontrunning).
        // To avoid leaving ETH in the contract this value is refunded.
        if (refundValue != 0) {
            // We know msg.sender != address(0) && requestsValue == msg.value
            // meaning we can ensure refundValue is not taken from the original contract's balance
            // and msg.sender is a known account.
            Address.sendValue(payable(msg.sender), refundValue);
        }
    }

    /// @notice Returns the block hash for the given block number
    /// @param blockNumber The block number
    function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
        blockHash = blockhash(blockNumber);
    }

    /// @notice Returns the block number
    function getBlockNumber() public view returns (uint256 blockNumber) {
        blockNumber = block.number;
    }

    /// @notice Returns the block coinbase
    function getCurrentBlockCoinbase() public view returns (address coinbase) {
        coinbase = block.coinbase;
    }

    /// @notice Returns the block prevrandao
    function getPrevRandao() public view returns (uint256 prevrandao) {
        prevrandao = block.prevrandao;
    }

    /// @notice Returns the block gas limit
    function getCurrentBlockGasLimit() public view returns (uint256 gaslimit) {
        gaslimit = block.gaslimit;
    }

    /// @notice Returns the block timestamp
    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    /// @notice Returns the (ETH) balance of a given address
    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }

    /// @notice Returns the block hash of the last block
    function getLastBlockHash() public view returns (bytes32 blockHash) {
        unchecked {
            blockHash = blockhash(block.number - 1);
        }
    }

    /// @notice Gets the base fee of the given block
    /// @notice Can revert if the BASEFEE opcode is not implemented by the given chain
    function getBasefee() public view returns (uint256 basefee) {
        basefee = block.basefee;
    }

    /// @notice Returns the chain id
    function getChainId() public view returns (uint256 chainid) {
        chainid = block.chainid;
    }
}
