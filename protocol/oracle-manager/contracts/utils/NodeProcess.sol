// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {NodeOutput} from "../storage/NodeOutput.sol";
import {NodeDefinition} from "../storage/NodeDefinition.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

import "../nodes/ReducerNode.sol";
import "../nodes/ExternalNode.sol";
import "../nodes/pyth/PythNode.sol";
import "../nodes/pyth/PythOffchainLookupNode.sol";
import "../nodes/ChainlinkNode.sol";
import "../nodes/PriceDeviationCircuitBreakerNode.sol";
import "../nodes/StalenessCircuitBreakerNode.sol";
import "../nodes/UniswapNode.sol";
import "../nodes/ConstantNode.sol";

library NodeProcess {
    /**
     * @notice Thrown when a node cannot be processed
     */
    error UnprocessableNode(bytes32 nodeId);

    /**
     * @dev Returns the output of a specified node.
     */
    function process(
        bytes32 nodeId,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) internal view returns (NodeOutput.Data memory price) {
        if (runtimeKeys.length != runtimeValues.length) {
            revert ParameterError.InvalidParameter(
                "runtimeValues",
                "must be same length as runtimeKeys"
            );
        }

        NodeDefinition.Data memory nodeDefinition = NodeDefinition.load(nodeId);

        if (nodeDefinition.nodeType == NodeDefinition.NodeType.REDUCER) {
            return
                ReducerNode.process(
                    _processParentNodeOutputs(nodeDefinition, runtimeKeys, runtimeValues),
                    nodeDefinition.parameters
                );
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL) {
            return
                ExternalNode.process(
                    _processParentNodeOutputs(nodeDefinition, runtimeKeys, runtimeValues),
                    nodeDefinition.parameters,
                    runtimeKeys,
                    runtimeValues
                );
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.CHAINLINK) {
            return ChainlinkNode.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.UNISWAP) {
            return UniswapNode.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.PYTH) {
            return PythNode.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.PYTH_OFFCHAIN_LOOKUP) {
            return
                PythOffchainLookupNode.process(
                    nodeDefinition.parameters,
                    runtimeKeys,
                    runtimeValues
                );
        } else if (
            nodeDefinition.nodeType == NodeDefinition.NodeType.PRICE_DEVIATION_CIRCUIT_BREAKER
        ) {
            return
                PriceDeviationCircuitBreakerNode.process(
                    _processParentNodeOutputs(nodeDefinition, runtimeKeys, runtimeValues),
                    nodeDefinition.parameters
                );
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.STALENESS_CIRCUIT_BREAKER) {
            return StalenessCircuitBreakerNode.process(nodeDefinition, runtimeKeys, runtimeValues);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.CONSTANT) {
            return ConstantNode.process(nodeDefinition.parameters);
        }
        revert UnprocessableNode(nodeId);
    }

    /**
     * @dev helper function that calls process on parent nodes.
     */
    function _processParentNodeOutputs(
        NodeDefinition.Data memory nodeDefinition,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) private view returns (NodeOutput.Data[] memory parentNodeOutputs) {
        parentNodeOutputs = new NodeOutput.Data[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            parentNodeOutputs[i] = process(nodeDefinition.parents[i], runtimeKeys, runtimeValues);
        }
    }
}
