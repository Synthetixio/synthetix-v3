//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {NodeOutput} from "./NodeOutput.sol";

import "../nodes/ReducerNode.sol";
import "../nodes/ExternalNode.sol";
import "../nodes/pyth/PythNode.sol";
import "../nodes/pyth/PythOffchainLookupNode.sol";
import "../nodes/ChainlinkNode.sol";
import "../nodes/PriceDeviationCircuitBreakerNode.sol";
import "../nodes/StalenessCircuitBreakerNode.sol";
import "../nodes/UniswapNode.sol";
import "../nodes/ConstantNode.sol";

library NodeDefinition {
    /**
     * @notice Thrown when a node cannot be processed
     */
    error UnprocessableNode(bytes32 nodeId);

    /**
     * @notice An array of revert reasons when an array of nodes is processed, but some of the nodes failed
     */
    error Errors(bytes[] revertReasons);

    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        UNISWAP,
        PYTH,
        PRICE_DEVIATION_CIRCUIT_BREAKER,
        STALENESS_CIRCUIT_BREAKER,
        CONSTANT,
        PYTH_OFFCHAIN_LOOKUP // works in conjunction with PYTH node
    }

    struct Data {
        /**
         * @dev Oracle node type enum
         */
        NodeType nodeType;
        /**
         * @dev Node parameters, specific to each node type
         */
        bytes parameters;
        /**
         * @dev Parent node IDs, if any
         */
        bytes32[] parents;
    }

    /**
     * @dev Returns the node stored at the specified node ID.
     */
    function load(bytes32 id) internal pure returns (Data storage node) {
        bytes32 s = keccak256(abi.encode("io.synthetix.oracle-manager.Node", id));
        assembly {
            node.slot := s
        }
    }

    /**
     * @dev Register a new node for a given node definition. The resulting node is a function of the definition.
     */
    function create(
        Data memory nodeDefinition
    ) internal returns (NodeDefinition.Data storage node, bytes32 id) {
        id = getId(nodeDefinition);

        node = load(id);

        node.nodeType = nodeDefinition.nodeType;
        node.parameters = nodeDefinition.parameters;
        node.parents = nodeDefinition.parents;
    }

    /**
     * @dev Returns a node ID based on its definition
     */
    function getId(Data memory nodeDefinition) internal pure returns (bytes32 id) {
        return
            keccak256(
                abi.encode(
                    nodeDefinition.nodeType,
                    nodeDefinition.parameters,
                    nodeDefinition.parents
                )
            );
    }

    /**
     * @dev Returns the output of a specified node.
     */
    function process(
        bytes32 nodeId,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) internal view returns (bytes memory possibleError, NodeOutput.Data memory price) {
        if (runtimeKeys.length != runtimeValues.length) {
            possibleError = abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "runtimeValues",
                "must be same length as runtimeKeys"
            );
            return (possibleError, price);
        }

        Data storage nodeDefinition = load(nodeId);
        NodeType nodeType = nodeDefinition.nodeType;

        (
            bytes[] memory errors,
            NodeOutput.Data[] memory parentNodeOutputs
        ) = _processParentNodeOutputs(nodeDefinition, runtimeKeys, runtimeValues);

        for (uint256 i = 0; i < errors.length; i++) {
            if (errors[i].length > 0) {
                // for now to keep things simpler, we revert if we have parent nodes giving a series of errors
                revert Errors(errors);
            }
        }

        if (nodeType == NodeType.REDUCER) {
            (possibleError, price) = ReducerNode.process(
                parentNodeOutputs,
                nodeDefinition.parameters
            );
        } else if (nodeType == NodeType.EXTERNAL) {
            (possibleError, price) = ExternalNode.process(
                parentNodeOutputs,
                nodeDefinition.parameters,
                runtimeKeys,
                runtimeValues
            );
        } else if (nodeType == NodeType.CHAINLINK) {
            (possibleError, price) = ChainlinkNode.process(nodeDefinition.parameters);
        } else if (nodeType == NodeType.UNISWAP) {
            (possibleError, price) = UniswapNode.process(nodeDefinition.parameters);
        } else if (nodeType == NodeType.PYTH) {
            (possibleError, price) = PythNode.process(nodeDefinition.parameters);
        } else if (nodeType == NodeType.PYTH_OFFCHAIN_LOOKUP) {
            (possibleError, price) = PythOffchainLookupNode.process(
                nodeDefinition.parameters,
                runtimeKeys,
                runtimeValues
            );
        } else if (nodeType == NodeType.PRICE_DEVIATION_CIRCUIT_BREAKER) {
            (possibleError, price) = PriceDeviationCircuitBreakerNode.process(
                parentNodeOutputs,
                nodeDefinition.parameters
            );
        } else if (nodeType == NodeType.STALENESS_CIRCUIT_BREAKER) {
            (possibleError, price) = StalenessCircuitBreakerNode.process(
                nodeDefinition,
                runtimeKeys,
                runtimeValues
            );
        } else if (nodeType == NodeType.CONSTANT) {
            (possibleError, price) = ConstantNode.process(nodeDefinition.parameters);
        } else {
            possibleError = abi.encodeWithSelector(UnprocessableNode.selector, nodeId);
        }
    }

    /**
     * @dev helper function that calls process on parent nodes.
     */
    function _processParentNodeOutputs(
        Data storage nodeDefinition,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    )
        private
        view
        returns (bytes[] memory possibleErrors, NodeOutput.Data[] memory parentNodeOutputs)
    {
        possibleErrors = new bytes[](nodeDefinition.parents.length);
        parentNodeOutputs = new NodeOutput.Data[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            (possibleErrors[i], parentNodeOutputs[i]) = process(
                nodeDefinition.parents[i],
                runtimeKeys,
                runtimeValues
            );
        }
    }
}
