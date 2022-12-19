// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";

// This can be used as a staleness circuit breaker if no fallback is provided
// Use cases includes using Uniswap if fresh prices are otherwise unavailable.
library StalenessFallbackReducer {
    error NoFallbackProvided();

    function process(
        Node.Data[] memory prices,
        bytes memory parameters
    ) internal view returns (Node.Data memory) {
        uint256 stalenessTolerance = abi.decode(parameters, (uint256));

        if (prices[0].timestamp + stalenessTolerance < block.timestamp) {
            return prices[0];
        } else if (prices[1].price == 0) {
            revert NoFallbackProvided();
        }
        return prices[1];
    }
}
