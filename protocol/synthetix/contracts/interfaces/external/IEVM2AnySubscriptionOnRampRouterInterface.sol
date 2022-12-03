//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/**
 * @notice Application contracts that intend to send messages via CCIP
 * will interact with this interface.
 */
interface IEVM2AnySubscriptionOnRampRouterInterface {
    struct EVM2AnySubscriptionMessage {
        bytes receiver; // Address of the receiver on the destination chain for EVM chains use abi.encode(destAddress).
        bytes data; // Bytes that we wish to send to the receiver
        IERC20[] tokens; // The ERC20 tokens we wish to send for EVM source chains
        uint256[] amounts; // The amount of ERC20 tokens we wish to send for EVM source chains
        uint256 gasLimit; // the gas limit for the call to the receiver for destination chains
    }

    /**
     * @notice Request a message to be sent to the destination chain
     * @param destChainId The destination chain ID
     * @param message The message payload
     */
    function ccipSend(uint256 destChainId, EVM2AnySubscriptionMessage calldata message) external;
}
