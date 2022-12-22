//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IOracleManagerModule.sol";
import "../utils/ReducerNodeLibrary.sol";
import "../utils/ExternalNodeLibrary.sol";
import "../utils/PythNodeLibrary.sol";
import "../utils/ChainlinkNodeLibrary.sol";
import "../utils/PriceDeviationCircuitBreaker.sol";
import "../utils/StalenessFallbackReducer.sol";
import "../utils/UniswapNodeLibrary.sol";

import "../storage/Node.sol";
import "../storage/NodeDefinition.sol";

contract OracleManagerModule is IOracleManagerModule {
    error UnsupportedNodeType(NodeDefinition.NodeType nodeType);

    event NodeRegistered(
        bytes32 nodeId,
        bytes32[] parents,
        NodeDefinition.NodeType nodeType,
        bytes parameters
    );

    /// @notice registers a new node
    function registerNode(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _registerNode(nodeDefinition);
    }

    /// @notice get the node Id by passing nodeDefinition
    function getNodeId(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external pure returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _getNodeId(nodeDefinition);
    }

    /// @notice get a node by nodeId
    function getNode(bytes32 nodeId) external pure returns (NodeDefinition.Data memory) {
        return _getNode(nodeId);
    }

    /// @notice the function to process the prices based on the node's type
    function process(bytes32 nodeId) external view returns (Node.Data memory) {
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

        (, nodeId) = NodeDefinition.create(nodeDefinition);

        emit NodeRegistered(
            nodeId,
            nodeDefinition.parents,
            nodeDefinition.nodeType,
            nodeDefinition.parameters
        );
    }

    function _isNodeRegistered(bytes32 nodeId) internal view returns (bool) {
        NodeDefinition.Data storage nodeDefinition = NodeDefinition.load(nodeId);
        return (nodeDefinition.nodeType != NodeDefinition.NodeType.NONE);
    }

    function _process(bytes32 nodeId) internal view returns (Node.Data memory price) {
        NodeDefinition.Data storage nodeDefinition = NodeDefinition.load(nodeId);

        Node.Data[] memory prices = new Node.Data[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            prices[i] = this.process(nodeDefinition.parents[i]);
        }

        if (nodeDefinition.nodeType == NodeDefinition.NodeType.REDUCER) {
            return ReducerNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL) {
            return ExternalNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.CHAINLINK) {
            return ChainlinkNodeLibrary.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.PYTH) {
            return PythNodeLibrary.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.UNISWAP) {
            return UniswapNodeLibrary.process(nodeDefinition.parameters);
        } else if (
            nodeDefinition.nodeType == NodeDefinition.NodeType.PriceDeviationCircuitBreaker
        ) {
            return PriceDeviationCircuitBreaker.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.StalenessFallbackReducer) {
            return PriceDeviationCircuitBreaker.process(prices, nodeDefinition.parameters);
        } else {
            revert UnsupportedNodeType(nodeDefinition.nodeType);
        }
    }
}
