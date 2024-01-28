//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

/**
 * @title System wide cross chain utility functions
 */
library CrossChain {
    error InsufficientBridgeFee(uint256 requiredAmount, uint256 availableAmount);
    error UnsupportedNetwork(uint64 chainId);

    function onlyCrossChain() internal view {
        if (ERC2771Context._msgSender() != address(this)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    function refundLeftoverGas(uint256 /*gasTokenUsed*/) internal returns (uint256 amountRefunded) {
        amountRefunded = address(this).balance;
        if (amountRefunded > 0) {
            (bool success, bytes memory result) = ERC2771Context._msgSender().call{
                value: amountRefunded
            }("");

            if (!success) {
                uint256 len = result.length;
                assembly {
                    revert(result, len)
                }
            }
        }
    }
}
