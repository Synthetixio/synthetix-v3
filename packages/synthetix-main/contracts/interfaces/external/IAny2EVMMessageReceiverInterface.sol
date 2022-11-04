//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

/**
 * @notice Application contracts that intend to receive CCIP messages from
 * the OffRampRouter should implement this interface.
 */
interface IAny2EVMMessageReceiverInterface {
    struct Any2EVMMessage {
        uint256 srcChainId;
        bytes sender;
        bytes data;
        IERC20[] destTokens;
        uint256[] amounts;
    }

    /**
     * @notice Called by the OffRampRouter to deliver a message
     * @param message CCIP Message
     * @dev Note ensure you check the msg.sender is the OffRampRouter
     */
    function ccipReceive(Any2EVMMessage calldata message) external;
}
