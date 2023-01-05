//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";

import "../interfaces/INodeModule.sol";
import "../nodes/ReducerNode.sol";
import "../nodes/ExternalNode.sol";
import "../nodes/PythNode.sol";
import "../nodes/ChainlinkNode.sol";
import "../nodes/PriceDeviationCircuitBreakerNode.sol";
import "../nodes/StalenessCircuitBreakerNode.sol";
import "../nodes/UniswapNode.sol";

import "../storage/NodeOutput.sol";
import "../storage/NodeDefinition.sol";

/**
 * @title Module for managing nodes
 * @dev See INodeModule.
 */
contract NodeModule is INodeModule {
    /**
     * @inheritdoc INodeModule
     */
    function registerNode(
        NodeDefinition.NodeType nodeType,
        bytes memory parameters,
        bytes32[] memory parents
    ) external returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _registerNode(nodeDefinition);
    }

    /**
     * @inheritdoc INodeModule
     */
    function getNodeId(
        NodeDefinition.NodeType nodeType,
        bytes memory parameters,
        bytes32[] memory parents
    ) external pure returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _getNodeId(nodeDefinition);
    }

    /**
     * @inheritdoc INodeModule
     */
    function getNode(bytes32 nodeId) external pure returns (NodeDefinition.Data memory) {
        return _getNode(nodeId);
    }

    /**
     * @inheritdoc INodeModule
     */
    function process(bytes32 nodeId) external view returns (NodeOutput.Data memory) {
        return _process(nodeId);
    }

    function _getNode(bytes32 nodeId) internal pure returns (NodeDefinition.Data storage) {
        return NodeDefinition.load(nodeId);
    }

    modifier onlyValidNodeType(NodeDefinition.NodeType nodeType) {
        if (!_validateNodeType(nodeType)) {
            revert UnsupportedNodeType(nodeType);
        }

        _;
    }

    function _validateNodeType(NodeDefinition.NodeType nodeType) internal pure returns (bool) {
        return (NodeDefinition.NodeType.REDUCER == nodeType ||
            NodeDefinition.NodeType.EXTERNAL == nodeType ||
            NodeDefinition.NodeType.CHAINLINK == nodeType ||
            NodeDefinition.NodeType.PYTH == nodeType ||
            NodeDefinition.NodeType.PriceDeviationCircuitBreaker == nodeType ||
            NodeDefinition.NodeType.UNISWAP == nodeType);
    }

    function _getNodeId(NodeDefinition.Data memory nodeDefinition) internal pure returns (bytes32) {
        return NodeDefinition.getId(nodeDefinition);
    }

    function _registerNode(
        NodeDefinition.Data memory nodeDefinition
    ) internal onlyValidNodeType(nodeDefinition.nodeType) returns (bytes32 nodeId) {
        nodeId = _getNodeId(nodeDefinition);
        //checks if the node is already registered
        if (_isNodeRegistered(nodeId)) {
            return nodeId;
        }
        // checks nodeDefinition.parents if they are valid
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            if (!_isNodeRegistered(nodeDefinition.parents[i])) {
                revert NodeNotRegistered(nodeDefinition.parents[i]);
            }
        }

        // If the node's type is external, confirm it supports the necessary interface.
        if (nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL) {
            address externalNode = abi.decode(nodeDefinition.parameters, (address));
            if (
                !ERC165Helper.safeSupportsInterface(externalNode, type(IExternalNode).interfaceId)
            ) {
                revert IncorrectExternalNodeInterface(externalNode);
            }
        }

        (, nodeId) = NodeDefinition.create(nodeDefinition);

        emit NodeRegistered(
            nodeId,
            nodeDefinition.nodeType,
            nodeDefinition.parameters,
            nodeDefinition.parents
        );
    }

    function _isNodeRegistered(bytes32 nodeId) internal view returns (bool) {
        NodeDefinition.Data storage nodeDefinition = NodeDefinition.load(nodeId);
        return (nodeDefinition.nodeType != NodeDefinition.NodeType.NONE);
    }

    function _process(bytes32 nodeId) internal view returns (NodeOutput.Data memory price) {
        NodeDefinition.Data storage nodeDefinition = NodeDefinition.load(nodeId);

        NodeOutput.Data[] memory prices = new NodeOutput.Data[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            prices[i] = this.process(nodeDefinition.parents[i]);
        }

        if (nodeDefinition.nodeType == NodeDefinition.NodeType.REDUCER) {
            return ReducerNode.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL) {
            return ExternalNode.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.CHAINLINK) {
            return ChainlinkNode.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.PYTH) {
            return PythNode.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.UNISWAP) {
            return UniswapNode.process(nodeDefinition.parameters);
        } else if (
            nodeDefinition.nodeType == NodeDefinition.NodeType.PriceDeviationCircuitBreaker
        ) {
            return PriceDeviationCircuitBreakerNode.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.StalenessCircuitBreaker) {
            return PriceDeviationCircuitBreakerNode.process(prices, nodeDefinition.parameters);
        } else {
            revert UnsupportedNodeType(nodeDefinition.nodeType);
        }
    }
}
