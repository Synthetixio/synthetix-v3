// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../utils/CcipClient.sol";

/// @notice Application contracts that intend to receive messages from
/// the router should implement this interface.
interface IAny2EVMMessageReceiver {
    /// @notice Router calls this to deliver a message.
    /// If this reverts, any token transfers also revert. The message
    /// will move to a FAILED state and become available for manual execution
    /// as a retry. Fees already paid are NOT currently refunded (may change).
    /// @param message CCIP Message
    /// @dev Note ensure you check the msg.sender is the router
    function ccipReceive(CcipClient.Any2EVMMessage calldata message) external;
}
