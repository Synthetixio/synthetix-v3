// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/NodeDefinition.sol";
import "../storage/NodeOutput.sol";

library StalenessCircuitBreakerNode {
    error StalenessToleranceExceeded();

    function process(
        NodeOutput.Data[] memory parentNodeOutputs,
        bytes memory parameters
    ) internal view returns (NodeOutput.Data memory) {
        uint256 stalenessTolerance = abi.decode(parameters, (uint256));

        if (block.timestamp - parentNodeOutputs[0].timestamp <= stalenessTolerance) {
            return parentNodeOutputs[0];
        } else if (parentNodeOutputs.length == 1 || parentNodeOutputs[1].price == 0) {
            revert StalenessToleranceExceeded();
        }
        return parentNodeOutputs[1];
    }

    function validate(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool) {
        // Must have 1-2 parents
        if (!(nodeDefinition.parents.length == 1 || nodeDefinition.parents.length == 2)) {
            return false;
        }

        // Must have correct length of parameters data
        if (nodeDefinition.parameters.length != 32) {
            return false;
        }

        return true;
    }
}
