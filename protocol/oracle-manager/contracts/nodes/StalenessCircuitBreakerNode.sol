// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeOutput.sol";

library StalenessCircuitBreakerNode {
    error NoFallbackProvided();

    function process(
        NodeOutput.Data[] memory parentNodeOutputs,
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory) {
        uint256 stalenessTolerance = abi.decode(parameters, (uint256));

        if (parentNodeOutputs[0].timestamp + stalenessTolerance < block.timestamp) {
            return parentNodeOutputs[0];
        } else if (parentNodeOutputs.length > 1 && parentNodeOutputs[1].price == 0) {
            revert NoFallbackProvided();
        }
        return parentNodeOutputs[1];
    }
}
