// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastBytes32} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {NodeDefinition} from "../storage/NodeDefinition.sol";
import {NodeOutput} from "../storage/NodeOutput.sol";

library StalenessCircuitBreakerNode {
    using SafeCastBytes32 for bytes32;

    error StalenessToleranceExceeded(bytes32 parentId, int256 price, uint256 staleTimestamp);

    function process(
        NodeDefinition.Data memory nodeDefinition,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) internal view returns (bytes memory possibleError, NodeOutput.Data memory nodeOutput) {
        uint256 stalenessTolerance = abi.decode(nodeDefinition.parameters, (uint256));

        for (uint256 i = 0; i < runtimeKeys.length; i++) {
            if (runtimeKeys[i] == "stalenessTolerance") {
                stalenessTolerance = runtimeValues[i].toUint();
                break;
            }
        }

        bytes32 priceNodeId = nodeDefinition.parents[0];
        NodeOutput.Data memory priceNodeOutput;
        (possibleError, priceNodeOutput) = NodeDefinition.process(
            priceNodeId,
            runtimeKeys,
            runtimeValues
        );

        if (
            possibleError.length > 0 ||
            block.timestamp - stalenessTolerance <= priceNodeOutput.timestamp
        ) {
            return (possibleError, priceNodeOutput);
        } else if (nodeDefinition.parents.length == 1) {
            possibleError = abi.encodeWithSelector(
                StalenessToleranceExceeded.selector,
                nodeDefinition.parents[0],
                priceNodeOutput.price,
                priceNodeOutput.timestamp
            );
        } else {
            // If there are two parents, return the output of the second parent (which in this case, should revert with OracleDataRequired)
            (possibleError, nodeOutput) = NodeDefinition.process(
                nodeDefinition.parents[1],
                runtimeKeys,
                runtimeValues
            );
        }
    }

    function isValid(NodeDefinition.Data memory nodeDefinition) internal pure returns (bool valid) {
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
