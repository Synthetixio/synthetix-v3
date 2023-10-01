//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title System wide cross chain utility functions
 */
library CrossChain {
    error InsufficientBridgeFee(uint256 requiredAmount, uint256 availableAmount);
    error UnsupportedNetwork(uint64 chainId);

    function onlyCrossChain() internal view {
        if (msg.sender != address(this)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function refundLeftoverGas(uint256 gasTokenUsed) internal returns (uint256 amountRefunded) {
        amountRefunded = address(this).balance;
        if (amountRefunded > 0) {
            (bool success, bytes memory result) = msg.sender.call{value: amountRefunded}("");

            if (!success) {
                uint256 len = result.length;
                assembly {
                    revert(result, len)
                }
            }
        }
    }
}
