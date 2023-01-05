// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeOutput.sol";

// This can be used as a staleness circuit breaker if no fallback is provided
// Use cases includes using Uniswap if fresh prices are otherwise unavailable.
library STALENESS_CIRCUIT_BREAKERNode {
    error NoFallbackProvided();

    function process(
        NodeOutput.Data[] memory prices,
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory) {
        uint256 stalenessTolerance = abi.decode(parameters, (uint256));

        if (prices[0].timestamp + stalenessTolerance < block.timestamp) {
            return prices[0];
        } else if (prices[1].price == 0) {
            revert NoFallbackProvided();
        }
        return prices[1];
    }
}
