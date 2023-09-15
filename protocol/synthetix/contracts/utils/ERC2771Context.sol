// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../storage/Config.sol";

library ERC2771Context {
    function _msgSender() internal view returns (address sender) {
        if (_isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            // The assembly code is more direct than the Solidity version using `abi.decode`.
            /// @solidity memory-safe-assembly
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return msg.sender;
        }
    }

    function _msgData() internal view returns (bytes calldata) {
        if (_isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }

    function _isTrustedForwarder(address forwarder) internal pure returns (bool) {
        return forwarder == trustedForwarder();
    }

    function trustedForwarder() internal pure returns (address) {
        return 0x04A11fC66B8eFC746F395E446d69e9bfAC5B83Bb;
    }
}
