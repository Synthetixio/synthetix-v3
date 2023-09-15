// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract ERC2771Context {
    // This is the trusted-multicall-forwarder. The address is constant due to CREATE2.
    address private constant TRUSTED_FORWARDER = 0xAE788aaf52780741E12BF79Ad684B91Bb0EF4D92;

    function _msgSender() internal view returns (address sender) {
        // solhint-disable-next-line erc2771/no-msg-sender erc2771/no-msg-data
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            // The assembly code is more direct than the Solidity version using `abi.decode`.
            /// @solidity memory-safe-assembly
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            // solhint-disable-next-line erc2771/no-msg-sender
            return msg.sender;
        }
    }

    function _msgData() internal view returns (bytes calldata) {
        // solhint-disable-next-line erc2771/no-msg-sender erc2771/no-msg-data
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            // solhint-disable-next-line erc2771/no-msg-data
            return msg.data[:msg.data.length - 20];
        } else {
            // solhint-disable-next-line erc2771/no-msg-data
            return msg.data;
        }
    }

    function isTrustedForwarder(address forwarder) internal pure returns (bool) {
        return forwarder == TRUSTED_FORWARDER;
    }

    function trustedForwarder() internal pure returns (address) {
        return TRUSTED_FORWARDER;
    }
}
